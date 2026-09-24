import {
  answerSchema,
  flagSchema,
  hostCreateSchema,
  hostResumeSchema,
  kickSchema,
  ladderWalkSchema,
  lifelineSchema,
  packVoteSchema,
  playerJoinSchema,
  playerResumeSchema,
  setAvatarSchema,
  setCategorySchema,
  timePingSchema,
  voteSchema,
  type ClientToServerEvents,
  type ErrorCode,
  type RoomClosedReason,
  type ServerToClientEvents,
} from '@trivia/shared';
import type { Server, Socket } from 'socket.io';
import { z } from 'zod';
import type { Clock } from '../clock.ts';
import type { Store } from '../db/store.ts';
import { toHostView, toPlayerView } from '../game/views.ts';
import type { Room } from '../rooms/Room.ts';
import type { RoomManager } from '../rooms/RoomManager.ts';
import type { RoomRunner } from '../rooms/RoomRunner.ts';

type GameServer = Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type GameSocket = Socket<ClientToServerEvents, ServerToClientEvents, object, SocketData>;
type Ack = (result: { ok: true } | { ok: false; error: ErrorCode }) => void;

/** Who a socket is, once it has created, joined or resumed a room. */
export type SocketData =
  | { role: 'host'; roomCode: string }
  | { role: 'player'; roomCode: string; playerId: string }
  | { role?: undefined };

const hostChannel = (code: string) => `host:${code}`;
const playerChannel = (code: string, playerId: string) => `player:${code}:${playerId}`;

const LATENCY_PROBE_MS = 3_000;
const emptyPayload = z.looseObject({});

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

export function closeRoom(io: GameServer, room: Room, reason: RoomClosedReason = 'expired'): void {
  io.to(hostChannel(room.code)).emit('room:closed', { reason });
  for (const id of room.players.keys()) {
    io.to(playerChannel(room.code, id)).emit('room:closed', { reason });
  }
}

export function attachSocketHandlers({ io, rooms, store, clock, log }: SocketDeps): void {
  io.on('connection', (socket: GameSocket) => {
    socket.data = {};
    let probe: ReturnType<typeof setInterval> | null = null;

    /** Validates the payload; replies BAD_REQUEST on garbage instead of throwing. */
    function parse<S extends z.ZodType>(schema: S, payload: unknown, ack: unknown): z.infer<S> | null {
      const parsed = schema.safeParse(payload ?? {});
      if (parsed.success) return parsed.data;
      if (typeof ack === 'function') ack({ ok: false, error: 'BAD_REQUEST' });
      return null;
    }

    /** The room and player id behind a player socket, or null (after acking an error). */
    function asPlayer(ack: unknown): { runner: RoomRunner; playerId: string } | null {
      const data = socket.data;
      const runner = data.role === 'player' ? rooms.get(data.roomCode) : undefined;
      if (data.role !== 'player' || !runner || !runner.room.players.has(data.playerId)) {
        if (typeof ack === 'function') ack({ ok: false, error: 'NOT_FOUND' });
        return null;
      }
      return { runner, playerId: data.playerId };
    }

    /** A socket belongs to at most one seat; re-binding drops the old one. */
    async function leaveCurrent(): Promise<void> {
      const data = socket.data;
      if (data.role === 'host') await socket.leave(hostChannel(data.roomCode));
      if (data.role === 'player') await socket.leave(playerChannel(data.roomCode, data.playerId));
      socket.data = {};
      if (probe) clearInterval(probe);
      probe = null;
    }

    /** Measures this phone's round trip ourselves, so clients can't fake it. */
    function startLatencyProbe(runner: RoomRunner, playerId: string): void {
      const measure = async () => {
        const sent = clock();
        try {
          await socket.timeout(2_000).emitWithAck('latency:probe', {});
          runner.room.recordLatency(playerId, clock() - sent);
        } catch {
          // Slow or gone; the disconnect handler deals with gone.
        }
      };
      void measure();
      probe = setInterval(measure, LATENCY_PROBE_MS);
    }

    async function bindPlayer(runner: RoomRunner, playerId: string): Promise<void> {
      await leaveCurrent();
      socket.data = { role: 'player', roomCode: runner.room.code, playerId };
      await socket.join(playerChannel(runner.room.code, playerId));
      startLatencyProbe(runner, playerId);
    }

    /** Runs a runner command for this player and acks its result. */
    function playerCommand<S extends z.ZodType>(
      schema: S,
      run: (runner: RoomRunner, playerId: string, input: z.infer<S>) => { ok: true } | { ok: false; error: ErrorCode },
    ) {
      return (payload: unknown, ack: Ack) => {
        const input = parse(schema, payload, ack);
        if (input === null) return;
        const who = asPlayer(ack);
        if (!who) return;
        ack(run(who.runner, who.playerId, input));
      };
    }

    socket.on('host:create', async (payload, ack) => {
      const input = parse(hostCreateSchema, payload, ack);
      if (!input) return;
      await leaveCurrent();
      const runner = rooms.create(input.householdId);
      const { room } = runner;
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
      const runner = rooms.get(input.roomCode);
      if (!runner || !runner.room.checkHostToken(input.hostToken)) return ack({ ok: false, error: 'NOT_FOUND' });
      await leaveCurrent();
      socket.data = { role: 'host', roomCode: runner.room.code };
      await socket.join(hostChannel(runner.room.code));
      ack({ ok: true });
      runner.hostBack();
    });

    socket.on('player:join', async (payload, ack) => {
      const input = parse(playerJoinSchema, payload, ack);
      if (!input) return;
      const runner = rooms.get(input.roomCode);
      if (!runner) return ack({ ok: false, error: 'NOT_FOUND' });
      const result = runner.room.join(input.name);
      if (!result.ok) return ack(result);
      const { player } = result;
      await bindPlayer(runner, player.id);
      ack({
        ok: true,
        roomCode: runner.room.code,
        playerId: player.id,
        sessionToken: player.sessionToken,
        avatar: player.avatar,
      });
      broadcast(io, runner.room, clock());
    });

    socket.on('player:resume', async (payload, ack) => {
      const input = parse(playerResumeSchema, payload, ack);
      if (!input) return;
      const runner = rooms.get(input.roomCode);
      const player = runner?.room.resumePlayer(input.playerId, input.sessionToken);
      if (!runner || !player) return ack({ ok: false, error: 'NOT_FOUND' });
      await bindPlayer(runner, player.id);
      ack({ ok: true });
      broadcast(io, runner.room, clock());
    });

    socket.on(
      'player:setAvatar',
      playerCommand(setAvatarSchema, (runner, playerId, avatar) => {
        const res = runner.room.setAvatar(playerId, avatar);
        if (res.ok) broadcast(io, runner.room, clock());
        return res;
      }),
    );

    socket.on(
      'vip:kick',
      playerCommand(kickSchema, (runner, playerId, { playerId: targetId }) => {
        const res = runner.room.kick(playerId, targetId);
        if (!res.ok) return res;
        const channel = playerChannel(runner.room.code, targetId);
        io.to(channel).emit('room:closed', { reason: 'kicked' });
        io.in(channel).socketsLeave(channel);
        broadcast(io, runner.room, clock());
        return res;
      }),
    );

    socket.on('pack:vote', playerCommand(packVoteSchema, (runner, playerId, { pack }) => runner.votePack(playerId, pack)));
    socket.on('vip:lockPack', playerCommand(emptyPayload, (runner, playerId) => runner.lockPack(playerId)));
    socket.on(
      'vip:setCategory',
      playerCommand(setCategorySchema, (runner, playerId, { categoryId, enabled }) =>
        runner.setCategory(playerId, categoryId, enabled),
      ),
    );
    socket.on('vip:backToPacks', playerCommand(emptyPayload, (runner, playerId) => runner.backToPacks(playerId)));
    socket.on('vip:start', playerCommand(emptyPayload, (runner, playerId) => runner.start(playerId)));
    socket.on('vip:playAgain', playerCommand(emptyPayload, (runner, playerId) => runner.start(playerId)));
    socket.on('vip:newLobby', playerCommand(emptyPayload, (runner, playerId) => runner.newLobby(playerId)));
    socket.on('vote:cast', playerCommand(voteSchema, (runner, playerId, { option }) => runner.vote(playerId, option)));
    socket.on(
      'answer:submit',
      playerCommand(answerSchema, (runner, playerId, { questionId, choice }) =>
        runner.answer(playerId, questionId, choice),
      ),
    );
    socket.on('ladder:walk', playerCommand(ladderWalkSchema, (runner, playerId, { walk }) => runner.walk(playerId, walk)));
    socket.on(
      'ladder:lifeline',
      playerCommand(lifelineSchema, (runner, playerId, input) =>
        runner.lifeline(playerId, input.kind, input.kind === 'phone' ? input.friendId : undefined),
      ),
    );
    socket.on(
      'question:flag',
      playerCommand(flagSchema, (runner, playerId, { questionId, reason }) =>
        runner.flag(playerId, questionId, reason),
      ),
    );

    socket.on('time:ping', (payload, ack) => {
      const input = timePingSchema.safeParse(payload);
      if (input.success && typeof ack === 'function') ack({ t: input.data.t, serverNow: clock() });
    });

    socket.on('disconnect', async () => {
      if (probe) clearInterval(probe);
      const data = socket.data;
      if (!data.role) return;
      const runner = rooms.get(data.roomCode);
      if (!runner) return;
      if (data.role === 'host') {
        // Another tab may have resumed the host seat already.
        const stillThere = await io.in(hostChannel(runner.room.code)).fetchSockets();
        if (stillThere.length === 0) runner.hostLeft();
      } else {
        const stillThere = await io.in(playerChannel(runner.room.code, data.playerId)).fetchSockets();
        if (stillThere.length === 0) runner.playerLeft(data.playerId);
      }
    });
  });
}
