/**
 * Socket.io connection manager for live tracking.
 *
 * Key design decisions (Uber-grade reliability):
 *   - Socket object is NEVER replaced after creation. All listeners registered
 *     via useSocketEvent stay attached forever. Token changes use socket.auth
 *     + disconnect/connect on the SAME object.
 *   - Room registry is module-level (not on the socket object). Survives
 *     reconnection and socket reuse.
 *   - Reconnection is infinite with 60s max backoff. The socket never gives up.
 *   - All room joins use ack callbacks to detect auth failures.
 */
import { io, Socket } from 'socket.io-client';
import { handleFeedEvent } from './driver-feed-tracker';

const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || '';
const TRACKING_NS = '/tracking';

let socket: Socket | null = null;

// ── Room tracking: module-level registry (survives socket reconnection) ──
type RoomEntry = { event: string; payload?: Record<string, string> };
const roomRegistry = new Map<string, RoomEntry>();

function trackRoom(roomKey: string, event: string, payload?: Record<string, string>): void {
  roomRegistry.set(roomKey, { event, payload });
}

function untrackRoom(roomKey: string): void {
  roomRegistry.delete(roomKey);
}

function rejoinAllRooms(): void {
  if (!socket?.connected) return;
  for (const [roomKey, entry] of roomRegistry) {
    const doEmit = () => {
      if (entry.payload) {
        socket!.emit(entry.event, entry.payload, (ack: any) => {
          if (socket?.connected && !ack?.joined) {
            console.warn(`[Socket] Re-join failed for ${roomKey} — auth may be expired`);
          }
        });
      } else {
        socket!.emit(entry.event, (ack: any) => {
          if (socket?.connected && !ack?.joined) {
            console.warn(`[Socket] Re-join failed for ${roomKey}`);
          }
        });
      }
    };
    doEmit();
  }
}

/**
 * Connect to the tracking WebSocket namespace with JWT auth.
 *
 * IMPORTANT: The socket object is created ONCE and never replaced.
 * All useSocketEvent listeners stay on the same object forever.
 * Token changes update socket.auth and reconnect the transport only.
 *
 * Safe to call multiple times — won't create duplicate connections.
 */
export function socketConnect(token?: string | null): Socket | null {
  if (!WS_URL) {
    console.warn('[Socket] VITE_WS_URL not set — skipping WebSocket connection');
    return null;
  }

  // Already connected — just update auth if token changed
  if (socket?.connected) {
    const currentToken = (socket.auth as any)?.token;
    if (token && token !== currentToken) {
      socket.auth = { token };
      socket.disconnect().connect();
    }
    return socket;
  }

  // Socket exists but disconnected — reuse the SAME object.
  // This preserves all useSocketEvent listeners attached to it.
  // socket.connect() resets the reconnection attempt counter.
  if (socket) {
    socket.auth = token ? { token } : {};
    socket.connect();
    return socket;
  }

  // First time ever — create the socket (this object lives for the session)
  const auth = token ? { token } : {};

  socket = io(`${WS_URL}${TRACKING_NS}`, {
    auth,
    transports: ['websocket', 'polling'], // prefer websocket, fall back to polling
    reconnection: true,
    // No reconnectionAttempts cap — the socket NEVER gives up.
    // Uber/WhatsApp keep trying forever. With 60s max backoff, this is
    // a single lightweight TCP attempt per minute — negligible battery/CPU cost.
    reconnectionDelay: 2000,
    reconnectionDelayMax: 60000,
    timeout: 10000,
  });

  // ── Shared driver-feed listener (single listener, persists for socket lifetime) ──
  socket.on('delivery:feed-update', (data) => {
    handleFeedEvent(data);
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
 * Disconnect from the tracking WebSocket and clear all room state.
 * Safe to call even if not connected.
 * Called on logout — the next socketConnect() will create a fresh socket.
 */
export function socketDisconnect(): void {
  roomRegistry.clear();
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
    socket.emit('join:delivery', { deliveryId }, (ack: any) => {
      if (socket?.connected && !ack?.joined) {
        console.warn(`[Socket] Failed to join delivery:${deliveryId} — auth may be expired`);
      }
    });
  } else {
    socket.once('connect', () => {
      socket!.emit('join:delivery', { deliveryId }, (ack: any) => {
        if (socket?.connected && !ack?.joined) {
          console.warn(`[Socket] Failed to join delivery:${deliveryId} — auth may be expired`);
        }
      });
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
    socket.emit('join:public', { token }, (ack: any) => {
      if (socket?.connected && !ack?.joined) {
        console.warn(`[Socket] Failed to join public room for token — link may be invalid`);
      }
    });
  } else {
    socket.once('connect', () => {
      socket!.emit('join:public', { token }, (ack: any) => {
        if (socket?.connected && !ack?.joined) {
          console.warn(`[Socket] Failed to join public room for token — link may be invalid`);
        }
      });
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
    socket.emit('join:dealer', { dealerId }, (ack: any) => {
      if (socket?.connected && !ack?.joined) {
        console.warn(`[Socket] Failed to join dealer:${dealerId} — auth may be expired`);
      }
    });
  } else {
    socket.once('connect', () => {
      socket!.emit('join:dealer', { dealerId }, (ack: any) => {
        if (socket?.connected && !ack?.joined) {
          console.warn(`[Socket] Failed to join dealer:${dealerId} — auth may be expired`);
        }
      });
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