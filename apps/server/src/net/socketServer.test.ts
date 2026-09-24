import type {
  ClientToServerEvents,
  HostView,
  PlayerView,
  ServerToClientEvents,
} from '@trivia/shared';
import type { AddressInfo } from 'node:net';
import { io as connect, type Socket } from 'socket.io-client';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.ts';
import { MemoryStore } from '../db/store.ts';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

const HOUSEHOLD = '6f1c1c2e-8d2b-4f7a-9a51-0c7a0c9b1d11';

let url = '';
let store: MemoryStore;
let close: () => Promise<void>;
const clients: Client[] = [];

beforeEach(async () => {
  store = new MemoryStore();
  const { app } = await createApp({ store, logger: false });
  await app.listen({ port: 0, host: '127.0.0.1' });
  url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  close = () => app.close();
});

afterEach(async () => {
  for (const c of clients.splice(0)) c.disconnect();
  await close();
});

function client(): Promise<Client> {
  const socket: Client = connect(url, { transports: ['websocket'], forceNew: true });
  clients.push(socket);
  return new Promise((resolve) => socket.on('connect', () => resolve(socket)));
}

/** Resolves with the next event payload that satisfies the predicate. */
function next<E extends 'view:host' | 'view:player'>(
  socket: Client,
  event: E,
  predicate: (v: Parameters<ServerToClientEvents[E]>[0]) => boolean = () => true,
): Promise<Parameters<ServerToClientEvents[E]>[0]> {
  return new Promise((resolve) => {
    const handler = (v: HostView & PlayerView) => {
      if (predicate(v)) {
        socket.off(event, handler as never);
        resolve(v);
      }
    };
    socket.on(event, handler as never);
  });
}

describe('lobby over sockets', () => {
  it('creates a room, joins a phone, and shows the player on the TV', async () => {
    const tv = await client();
    const created = await tv.emitWithAck('host:create', { householdId: HOUSEHOLD, lang: 'hu' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.roomCode).toMatch(/^[BCDFGHJKLMNPQRSTVWXZ]{4}$/);
    expect(store.households.has(HOUSEHOLD)).toBe(true);

    const phone = await client();
    const tvSeesAnna = next(tv, 'view:host', (v) => v.players.length === 1);
    const phoneView = next(phone, 'view:player');
    const joined = await phone.emitWithAck('player:join', {
      roomCode: created.roomCode.toLowerCase(),
      name: 'Anna',
    });
    expect(joined.ok).toBe(true);

    const hostView = await tvSeesAnna;
    expect(hostView.players[0]).toMatchObject({ name: 'Anna', isVip: true, connected: true });
    const view = await phoneView;
    expect(view.me.name).toBe('Anna');
    expect(view.lang).toBe('hu');
  });

  it('rejects bad payloads and unknown rooms without crashing', async () => {
    const phone = await client();
    expect(await phone.emitWithAck('player:join', { roomCode: 'BC', name: 'x' } as never)).toEqual({
      ok: false,
      error: 'BAD_REQUEST',
    });
    expect(await phone.emitWithAck('player:join', { roomCode: 'ZZZZ', name: 'Anna' })).toEqual({
      ok: false,
      error: 'NOT_FOUND',
    });
  });

  it('lets a phone that dropped resume the same seat', async () => {
    const tv = await client();
    const created = await tv.emitWithAck('host:create', { householdId: HOUSEHOLD, lang: 'en' });
    if (!created.ok) throw new Error('create failed');

    const phone = await client();
    const joined = await phone.emitWithAck('player:join', { roomCode: created.roomCode, name: 'Anna' });
    if (!joined.ok) throw new Error('join failed');

    const tvSeesDrop = next(tv, 'view:host', (v) => v.players[0]?.connected === false);
    phone.disconnect();
    await tvSeesDrop;

    const phone2 = await client();
    const tvSeesBack = next(tv, 'view:host', (v) => v.players[0]?.connected === true);
    const resumed = await phone2.emitWithAck('player:resume', {
      roomCode: joined.roomCode,
      playerId: joined.playerId,
      sessionToken: joined.sessionToken,
    });
    expect(resumed).toEqual({ ok: true });
    const view = await tvSeesBack;
    expect(view.players).toHaveLength(1);
    expect(view.players[0]?.name).toBe('Anna');
  });

  it('lets a refreshed TV resume its room, but not with a wrong token', async () => {
    const tv = await client();
    const created = await tv.emitWithAck('host:create', { householdId: HOUSEHOLD, lang: 'en' });
    if (!created.ok) throw new Error('create failed');
    tv.disconnect();

    const tv2 = await client();
    expect(
      await tv2.emitWithAck('host:resume', { roomCode: created.roomCode, hostToken: 'x'.repeat(32) }),
    ).toEqual({ ok: false, error: 'NOT_FOUND' });
    const view = next(tv2, 'view:host');
    expect(await tv2.emitWithAck('host:resume', created)).toEqual({ ok: true });
    expect((await view).roomCode).toBe(created.roomCode);
  });

  it('answers clock pings with server time', async () => {
    const phone = await client();
    const res = await phone.emitWithAck('time:ping', { t: 42 });
    expect(res.t).toBe(42);
    expect(Math.abs(res.serverNow - Date.now())).toBeLessThan(1000);
  });
});
