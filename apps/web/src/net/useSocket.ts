import { useEffect, useState } from 'react';
import { createSocket, type GameSocket } from './socket.ts';

/** One socket per mounted screen, closed on unmount. */
export function useSocket(): GameSocket {
  const [socket] = useState(createSocket);
  useEffect(() => {
    if (!socket.connected) socket.connect();
    return () => {
      socket.disconnect();
    };
  }, [socket]);
  return socket;
}
