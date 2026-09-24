import fastifyStatic from '@fastify/static';
import {
  HOST_ABSENT_ROOM_TTL_MS,
  LOBBY_DISCONNECT_GRACE_MS,
  type ClientToServerEvents,
  type ServerToClientEvents,
} from '@trivia/shared';
import Fastify from 'fastify';
import { existsSync } from 'node:fs';
import { Server } from 'socket.io';
import { systemClock, type Clock } from './clock.ts';
import type { Rng } from './content/select.ts';
import type { Store } from './db/store.ts';
import type { SpeechLengths } from './game/speech.ts';
import { attachSocketHandlers, broadcast, closeRoom, type SocketData } from './net/socketServer.ts';
import { RoomManager } from './rooms/RoomManager.ts';

export interface AppOptions {
  store: Store;
  clock?: Clock;
  rng?: Rng;
  /** Multiplies every phase length; < 1 speeds games up for tests. */
  timingScale?: number;
  totalRounds?: number;
  /** Built web app to serve; skipped when missing (dev uses the Vite server). */
  webDistDir?: string;
  sweepIntervalMs?: number;
  /** How long Otto's recorded lines take (none by default). */
  speech?: SpeechLengths;
  logger?: boolean;
}

export async function createApp(opts: AppOptions) {
  const clock = opts.clock ?? systemClock;
  const app = Fastify({ logger: opts.logger ?? true });

  const io = new Server<ClientToServerEvents, ServerToClientEvents, object, SocketData>(app.server, {
    // Phones on flaky Wi-Fi: notice drops within ~10s, not the default ~45s.
    pingInterval: 5_000,
    pingTimeout: 5_000,
  });

  const rooms = new RoomManager({
    clock,
    store: opts.store,
    rng: opts.rng,
    timingScale: opts.timingScale,
    speech: opts.speech,
    totalRounds: opts.totalRounds,
    lobbyGraceMs: LOBBY_DISCONNECT_GRACE_MS,
    hostAbsentTtlMs: HOST_ABSENT_ROOM_TTL_MS,
    onChange: (room) => broadcast(io, room, clock()),
    onClose: (room) => closeRoom(io, room),
    log: app.log,
  });
  attachSocketHandlers({ io, rooms, store: opts.store, clock, log: app.log });

  const sweeper = setInterval(() => rooms.sweep(), opts.sweepIntervalMs ?? 5_000);
  sweeper.unref();

  app.get('/healthz', async () => ({
    ok: true,
    rooms: rooms.size,
    db: await opts.store.ping(),
  }));

  if (opts.webDistDir && existsSync(opts.webDistDir)) {
    await app.register(fastifyStatic, { root: opts.webDistDir, wildcard: false });
    // Client-side routes (/tv, /ABCD) all load the single-page app.
    app.setNotFoundHandler((req, reply) => {
      if (req.method === 'GET' && !req.url.startsWith('/socket.io')) {
        return reply.sendFile('index.html');
      }
      return reply.code(404).send({ error: 'Not found' });
    });
  }

  app.addHook('onClose', async () => {
    clearInterval(sweeper);
    io.close();
    await opts.store.close();
  });

  return { app, io, rooms };
}
