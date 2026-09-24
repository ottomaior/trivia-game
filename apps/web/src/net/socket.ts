import type { ClientToServerEvents, ServerToClientEvents } from '@trivia/shared';
import { io, type Socket } from 'socket.io-client';

export type GameSocket = Socket<ServerToClientEvents, ClientToServerEvents>;

/**
 * Same-origin connection: the server serves this app in production, Vite
 * proxies in dev. Not auto-connected, so listeners are attached before the
 * first 'connect' can fire (see useSocket).
 */
export function createSocket(): GameSocket {
  return io({ autoConnect: false, reconnectionDelayMax: 3_000 });
}

export const ACK_TIMEOUT_MS = 8_000;
