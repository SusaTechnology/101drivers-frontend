/**
 * React hook for listening to Socket.io events on the tracking namespace.
 *
 * Handles the case where the socket hasn't been created yet (e.g., during
 * page refresh before auth completes) by polling until it appears.
 */
import { useEffect, useState, useRef } from 'react';
import { getSocket, isSocketConnected } from '@/lib/socket';
import type { Socket } from 'socket.io-client';

/**
 * Subscribe to a Socket.io event. Automatically unsubscribes on unmount.
 *
 * Uses a ref for the handler so it always calls the latest version
 * without needing to re-register on every render.
 *
 * @param event - Socket.io event name (e.g., 'delivery:location-update')
 * @param handler - Callback function when event is received
 */
export function useSocketEvent<T = any>(event: string, handler: (data: T) => void): void {
  const handlerRef = useRef(handler);
  useEffect(() => { handlerRef.current = handler; });

  useEffect(() => {
    let disposed = false;
    const listener = (data: T) => handlerRef.current(data);

    const tryRegister = (): boolean => {
      const socket = getSocket();
      if (!socket || disposed) return false;
      socket.on(event, listener);
      return true;
    };

    // Try registering immediately
    if (tryRegister()) {
      return () => {
        disposed = true;
        const s = getSocket();
        if (s) s.off(event, listener);
      };
    }

    // Socket not created yet (e.g. auth still loading).
    // Poll until it appears — runs for ~1-2s max after page load.
    const poll = setInterval(() => {
      if (tryRegister()) clearInterval(poll);
    }, 100);

    return () => {
      disposed = true;
      clearInterval(poll);
      const s = getSocket();
      if (s) s.off(event, listener);
    };
  }, [event]);
}

/**
 * Returns true when the socket is connected, false when disconnected or null.
 * Re-renders on connect/disconnect so components can react to connection state.
 */
export function useSocketConnected(): boolean {
  const [connected, setConnected] = useState(isSocketConnected);

  useEffect(() => {
    let disposed = false;
    let targetSocket: Socket | null = null;

    const onConnect = () => { if (!disposed) setConnected(true); };
    const onDisconnect = () => { if (!disposed) setConnected(false); };

    const tryWatch = (): boolean => {
      const socket = getSocket();
      if (!socket || disposed) return false;
      targetSocket = socket;
      setConnected(socket.connected);
      socket.on('connect', onConnect);
      socket.on('disconnect', onDisconnect);
      return true;
    };

    if (tryWatch()) {
      return () => {
        disposed = true;
        if (targetSocket) {
          targetSocket.off('connect', onConnect);
          targetSocket.off('disconnect', onDisconnect);
        }
      };
    }

    // Socket not created yet — poll until it appears
    const poll = setInterval(() => {
      if (tryWatch()) clearInterval(poll);
    }, 100);

    return () => {
      disposed = true;
      clearInterval(poll);
      if (targetSocket) {
        targetSocket.off('connect', onConnect);
        targetSocket.off('disconnect', onDisconnect);
      }
    };
  }, []);

  return connected;
}
