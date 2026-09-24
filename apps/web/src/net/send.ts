import type { ClientToServerEvents, ErrorCode } from '@trivia/shared';
import { ACK_TIMEOUT_MS, type GameSocket } from './socket.ts';

type PlayerCommand =
  | 'player:setAvatar'
  | 'pack:vote'
  | 'vip:lockPack'
  | 'vip:setCategory'
  | 'vip:backToPacks'
  | 'vip:start'
  | 'vip:kick'
  | 'vip:playAgain'
  | 'vip:newLobby'
  | 'vote:cast'
  | 'answer:submit'
  | 'ladder:walk'
  | 'ladder:lifeline'
  | 'question:flag'
  | 'power:choose'
  | 'power:pass'
  | 'power:clear';

/** Sends a phone command and resolves to its result; a timeout counts as a failure. */
export async function send<E extends PlayerCommand>(
  socket: GameSocket,
  event: E,
  payload: Parameters<ClientToServerEvents[E]>[0],
): Promise<{ ok: true } | { ok: false; error: ErrorCode | 'TIMEOUT' }> {
  try {
    // The overloads for emitWithAck can't narrow a generic event name, so
    // call through a loosely typed (but still bound) reference.
    const timed = socket.timeout(ACK_TIMEOUT_MS) as unknown as {
      emitWithAck(e: string, p: unknown): Promise<{ ok: true } | { ok: false; error: ErrorCode }>;
    };
    return await timed.emitWithAck(event, payload);
  } catch {
    return { ok: false, error: 'TIMEOUT' };
  }
}
