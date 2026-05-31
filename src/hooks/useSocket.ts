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
import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';

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
