import { useEffect, useState } from 'react';
import type { GameSocket } from './socket.ts';

/** Tracks the socket's connection state for "Reconnecting…" banners. */
export function useConnected(socket: GameSocket): boolean {
  const [connected, setConnected] = useState(socket.connected);
  useEffect(() => {
    const on = () => setConnected(true);
    const off = () => setConnected(false);
    socket.on('connect', on);
    socket.on('disconnect', off);
    // The state may have changed between render and this effect.
    setConnected(socket.connected);
    return () => {
      socket.off('connect', on);
      socket.off('disconnect', off);
    };
  }, [socket]);
  return connected;
}
