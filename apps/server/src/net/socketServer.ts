import {
  hostCreateSchema,
  hostResumeSchema,
  playerJoinSchema,
  playerResumeSchema,
  timePingSchema,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@trivia/shared';
import type { Server, Socket } from 'socket.io';
import type { z } from 'zod';
import type { Clock } from '../clock.ts';
import type { Store } from '../db/store.ts';
import { toHostView, toPlayerView } from '../game/views.ts';
import type { Room } from '../rooms/Room.ts';
import type { RoomManager } from '../rooms/RoomManager.ts';

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;

/** Who a socket is, once it has created, joined or resumed a room. */
export type SocketData =
  | { role: 'host'; roomCode: string }
  | { role: 'player'; roomCode: string; playerId: string }
  | { role?: undefined };

const hostChannel = (code: string) => `host:${code}`;
const playerChannel = (code: string, playerId: string) => `player:${code}:${playerId}`;

export interface SocketDeps {
  io: GameServer;
  rooms: RoomManager;
  store: Store;
  clock: Clock;
  log: { warn: (obj: object, msg: string) => void };
}

/** Sends every connected screen in the room its fresh view. */
export function broadcast(io: GameServer, room: Room, now: number): void {
  io.to(hostChannel(room.code)).emit('view:host', toHostView(room, now));
  for (const player of room.players.values()) {
    const view = toPlayerView(room, player.id, now);
    if (view) io.to(playerChannel(room.code, player.id)).emit('view:player', view);
  }
}

export function closeRoom(io: GameServer, room: Room): void {
  io.to(hostChannel(room.code)).emit('room:closed', { reason: 'expired' });
  for (const id of room.players.keys()) {
    io.to(playerChannel(room.code, id)).emit('room:closed', { reason: 'expired' });
  }
}

export function attachSocketHandlers({ io, rooms, store, clock, log }: SocketDeps): void {
  io.on('connection', (socket: GameSocket) => {
    socket.data = {};

    /** Validates the payload; replies BAD_REQUEST on garbage instead of throwing. */
    function parse<S extends z.ZodType>(
      schema: S,
      payload: unknown,
      ack: unknown,
    ): z.infer<S> | null {
      const parsed = schema.safeParse(payload);
      if (parsed.success) return parsed.data;
      if (typeof ack === 'function') ack({ ok: false, error: 'BAD_REQUEST' });
      return null;
    }

    /** A socket belongs to at most one room seat; re-binding drops the old one. */
    async function leaveCurrent(): Promise<void> {
      const data = socket.data;
      if (data.role === 'host') await socket.leave(hostChannel(data.roomCode));
      if (data.role === 'player') await socket.leave(playerChannel(data.roomCode, data.playerId));
      socket.data = {};
    }

    socket.on('host:create', async (payload, ack) => {
      const input = parse(hostCreateSchema, payload, ack);
      if (!input) return;
      await leaveCurrent();
      const room = rooms.create(input.householdId, input.lang);
      room.hostConnectedNow();
      socket.data = { role: 'host', roomCode: room.code };
      await socket.join(hostChannel(room.code));
      ack({ ok: true, roomCode: room.code, hostToken: room.hostToken });
      broadcast(io, room, clock());
      store.touchHousehold(input.householdId).catch((err: unknown) => {
        log.warn({ err }, 'touchHousehold failed');
      });
    });

    socket.on('host:resume', async (payload, ack) => {
      const input = parse(hostResumeSchema, payload, ack);
      if (!input) return;
      const room = rooms.get(input.roomCode);
      if (!room || !room.checkHostToken(input.hostToken)) return ack({ ok: false, error: 'NOT_FOUND' });
      await leaveCurrent();
      room.hostConnectedNow();
      socket.data = { role: 'host', roomCode: room.code };
      await socket.join(hostChannel(room.code));
      ack({ ok: true });
      broadcast(io, room, clock());
    });

    socket.on('player:join', async (payload, ack) => {
      const input = parse(playerJoinSchema, payload, ack);
      if (!input) return;
      const room = rooms.get(input.roomCode);
      if (!room) return ack({ ok: false, error: 'NOT_FOUND' });
      const result = room.join(input.name);
      if (!result.ok) return ack(result);
      await leaveCurrent();
      const { player } = result;
      socket.data = { role: 'player', roomCode: room.code, playerId: player.id };
      await socket.join(playerChannel(room.code, player.id));
      ack({
        ok: true,
        roomCode: room.code,
        playerId: player.id,
        sessionToken: player.sessionToken,
        avatar: player.avatar,
      });
      broadcast(io, room, clock());
    });

    socket.on('player:resume', async (payload, ack) => {
      const input = parse(playerResumeSchema, payload, ack);
      if (!input) return;
      const room = rooms.get(input.roomCode);
      const player = room?.resumePlayer(input.playerId, input.sessionToken);
      if (!room || !player) return ack({ ok: false, error: 'NOT_FOUND' });
      await leaveCurrent();
      socket.data = { role: 'player', roomCode: room.code, playerId: player.id };
      await socket.join(playerChannel(room.code, player.id));
      ack({ ok: true });
      broadcast(io, room, clock());
    });

    socket.on('time:ping', (payload, ack) => {
      const input = timePingSchema.safeParse(payload);
      if (input.success && typeof ack === 'function') ack({ t: input.data.t, serverNow: clock() });
    });

    socket.on('disconnect', async () => {
      const data = socket.data;
      if (!data.role) return;
      const room = rooms.get(data.roomCode);
      if (!room) return;
      const now = clock();
      if (data.role === 'host') {
        // Another tab may have resumed the host seat already.
        const stillThere = await io.in(hostChannel(room.code)).fetchSockets();
        if (stillThere.length === 0) room.hostDisconnectedNow(now);
      } else {
        const stillThere = await io.in(playerChannel(room.code, data.playerId)).fetchSockets();
        if (stillThere.length === 0 && room.playerDisconnected(data.playerId, now)) {
          broadcast(io, room, now);
        }
      }
    });
  });
}
