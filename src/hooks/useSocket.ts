/**
 * React hook for listening to Socket.io events on the tracking namespace.
 *
 * Usage:
 *   useSocketEvent('delivery:location-update', (data) => {
 *     setDriverPosition({ lat: data.lat, lng: data.lng });
 *   });
 *
 * To revert: delete this file + src/lib/socket.ts.
 */
import { useEffect, useState } from 'react';
import { getSocket, isSocketConnected } from '@/lib/socket';

/**
 * Subscribe to a Socket.io event. Automatically unsubscribes on unmount.
 *
 * @param event - Socket.io event name (e.g., 'delivery:location-update')
 * @param handler - Callback function when event is received
 */
export function useSocketEvent<T = any>(event: string, handler: (data: T) => void): void {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    socket.on(event, handler);

    return () => {
      socket.off(event, handler);
    };
  }, [event, handler]);
}

/**
 * Returns true when the socket is connected, false when disconnected or null.
 * Re-renders on connect/disconnect so components can react to connection state.
 */
export function useSocketConnected(): boolean {
  const [connected, setConnected] = useState(isSocketConnected);

  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;

    // Sync initial state
    setConnected(socket.connected);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);

    socket.on('connect', onConnect);
    socket.on('disconnect', onDisconnect);

    return () => {
      socket.off('connect', onConnect);
      socket.off('disconnect', onDisconnect);
    };
  }, []);

  return connected;
}
