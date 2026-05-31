/**
 * Socket.io connection manager for live tracking.
 *
 * Rooms:
 *   delivery:<id> — track a specific delivery
 *   public:<token> — unauthenticated tracking link
 *   dealer:<dealerId> — dealer dashboard
 *   driver-feed — driver gig board
 */
import { io, Socket } from 'socket.io-client';

const WS_URL = import.meta.env.VITE_WS_URL || import.meta.env.VITE_API_URL || '';
const TRACKING_NS = '/tracking';

let socket: Socket | null = null;

/** Connect to the tracking namespace. Safe to call multiple times. */
export function socketConnect(token?: string | null): Socket | null {
  if (!WS_URL) return null;
  if (socket?.connected) return socket;
  if (socket) { socket.disconnect(); socket = null; }

  const auth = token ? { token } : {};

  socket = io(`${WS_URL}${TRACKING_NS}`, {
    auth,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 2000,
    reconnectionDelayMax: 30000,
    timeout: 10000,
  });

  socket.on('connect', () => console.log('[Socket] Connected to tracking namespace'));
  socket.on('disconnect', (reason) => console.log(`[Socket] Disconnected: ${reason}`));
  socket.on('connect_error', (err) => console.warn('[Socket] Connection error:', err.message));

  return socket;
}

/** Disconnect and clean up. */
export function socketDisconnect(): void {
  if (socket) { socket.disconnect(); socket = null; }
}

/** Get the current socket instance. */
export function getSocket(): Socket | null {
  return socket;
}

// ── Room helpers (auto-queue if socket still connecting) ──

function emitWhenReady(event: string, data: any): void {
  if (!socket) return;
  if (socket.connected) {
    socket.emit(event, data);
  } else {
    socket.once('connect', () => socket!.emit(event, data));
  }
}

export function socketJoinDelivery(deliveryId: string): void {
  emitWhenReady('join:delivery', { deliveryId });
}

export function socketLeaveDelivery(deliveryId: string): void {
  if (socket?.connected) socket.emit('leave:delivery', { deliveryId });
}

export function socketJoinPublic(token: string): void {
  emitWhenReady('join:public', { token });
}

export function socketLeavePublic(token: string): void {
  if (socket?.connected) socket.emit('leave:public', { token });
}

export function socketJoinDealer(dealerId: string): void {
  emitWhenReady('join:dealer', { dealerId });
}

export function socketLeaveDealer(dealerId: string): void {
  if (socket?.connected) socket.emit('leave:dealer', { dealerId });
}

export function socketJoinDriverFeed(): void {
  emitWhenReady('join:driver-feed', {});
}

export function socketLeaveDriverFeed(): void {
  if (socket?.connected) socket.emit('leave:driver-feed');
}
