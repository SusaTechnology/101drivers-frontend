/**
 * Socket.io connection manager for live tracking.
 *
 * To revert: delete this file + src/hooks/useSocket.ts, remove socketConnect/socketDisconnect
 * calls from dataQuery.ts, restore original refetchInterval values in tracking pages.
 */
import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || '';
const TRACKING_NS = '/tracking';

let socket: Socket | null = null;

// ── Room tracking: auto re-join on reconnect ──
type RoomEntry = { event: string; payload?: Record<string, string> };
const activeRooms = new Set<string>();

function trackRoom(roomKey: string, event: string, payload?: Record<string, string>): void {
  activeRooms.add(roomKey);
  // Store the event + payload so we can re-emit on reconnect
  if (!socket) return;
  (socket as any).__rooms = (socket as any).__rooms || {};
  (socket as any).__rooms[roomKey] = { event, payload };
}

function untrackRoom(roomKey: string): void {
  activeRooms.delete(roomKey);
  if (socket) {
    (socket as any).__rooms = (socket as any).__rooms || {};
    delete (socket as any).__rooms[roomKey];
  }
}

function rejoinAllRooms(): void {
  if (!socket) return;
  const rooms = (socket as any).__rooms || {};
  for (const [roomKey, entry] of Object.entries<RoomEntry>(rooms)) {
    if (entry.payload) {
      socket.emit(entry.event, entry.payload);
    } else {
      socket.emit(entry.event);
    }
    console.log(`[Socket] Re-joined room: ${roomKey}`);
  }
}

/**
 * Connect to the tracking WebSocket namespace with JWT auth.
 * Safe to call multiple times — won't create duplicate connections.
 */
export function socketConnect(token?: string | null): Socket | null {
  if (!WS_URL) {
    console.warn('[Socket] VITE_WS_URL not set — skipping WebSocket connection');
    return null;
  }

  // Don't reconnect if already connected to same URL
  if (socket?.connected) {
    return socket;
  }

  // Clean up any existing disconnected socket
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const auth = token ? { token } : {};

  socket = io(`${WS_URL}${TRACKING_NS}`, {
    auth,
    transports: ['websocket', 'polling'], // prefer websocket, fall back to polling
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected to tracking namespace');
    // Re-join all tracked rooms after reconnect
    rejoinAllRooms();
  });

  socket.on('disconnect', (reason) => {
    console.log(`[Socket] Disconnected: ${reason}`);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  return socket;
}

/**
 * Disconnect from the tracking WebSocket.
 * Safe to call even if not connected.
 */
export function socketDisconnect(): void {
  activeRooms.clear();
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/**
 * Get the current socket instance (null if not connected).
 */
export function getSocket(): Socket | null {
  return socket;
}

/**
 * Whether the socket is currently connected.
 */
export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

/**
 * Join a delivery room (authenticated).
 * If socket is still connecting, queues the join for when it connects.
 */
export function socketJoinDelivery(deliveryId: string): void {
  if (!socket) return;
  trackRoom(`delivery:${deliveryId}`, 'join:delivery', { deliveryId });
  if (socket.connected) {
    socket.emit('join:delivery', { deliveryId });
  } else {
    socket.once('connect', () => {
      socket!.emit('join:delivery', { deliveryId });
    });
  }
}

/**
 * Leave a delivery room.
 */
export function socketLeaveDelivery(deliveryId: string): void {
  untrackRoom(`delivery:${deliveryId}`);
  if (socket?.connected) {
    socket.emit('leave:delivery', { deliveryId });
  }
}

/**
 * Join a public tracking room (no auth required).
 * If socket is still connecting, queues the join for when it connects.
 */
export function socketJoinPublic(token: string): void {
  if (!socket) return;
  trackRoom(`public:${token}`, 'join:public', { token });
  if (socket.connected) {
    socket.emit('join:public', { token });
  } else {
    // Socket still connecting — wait for 'connect' then join
    socket.once('connect', () => {
      socket!.emit('join:public', { token });
    });
  }
}

/**
 * Leave a public tracking room.
 */
export function socketLeavePublic(token: string): void {
  untrackRoom(`public:${token}`);
  if (socket?.connected) {
    socket.emit('leave:public', { token });
  }
}

/**
 * Join a dealer dashboard room (authenticated).
 */
export function socketJoinDealer(dealerId: string): void {
  if (!socket) return;
  trackRoom(`dealer:${dealerId}`, 'join:dealer', { dealerId });
  if (socket.connected) {
    socket.emit('join:dealer', { dealerId });
  } else {
    socket.once('connect', () => {
      socket!.emit('join:dealer', { dealerId });
    });
  }
}

/**
 * Leave a dealer dashboard room.
 */
export function socketLeaveDealer(dealerId: string): void {
  untrackRoom(`dealer:${dealerId}`);
  if (socket?.connected) {
    socket.emit('leave:dealer', { dealerId });
  }
}

/**
 * Join the driver gig board feed room (authenticated).
 */
export function socketJoinDriverFeed(): void {
  if (!socket) return;
  trackRoom('driver-feed', 'join:driver-feed');
  if (socket.connected) {
    socket.emit('join:driver-feed');
  } else {
    socket.once('connect', () => {
      socket!.emit('join:driver-feed');
    });
  }
}

/**
 * Leave the driver gig board feed room.
 */
export function socketLeaveDriverFeed(): void {
  untrackRoom('driver-feed');
  if (socket?.connected) {
    socket.emit('leave:driver-feed');
  }
}
