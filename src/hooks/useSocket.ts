/**
 * React hook for listening to Socket.io events on the tracking namespace.
 * Automatically subscribes on mount, unsubscribes on unmount.
 */
import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';

export function useSocketEvent<T = any>(event: string, handler: (data: T) => void): void {
  useEffect(() => {
    const socket = getSocket();
    if (!socket) return;
    socket.on(event, handler);
    return () => { socket.off(event, handler); };
  }, [event, handler]);
}
