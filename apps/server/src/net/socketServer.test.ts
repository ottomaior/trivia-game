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
import { fixtureContent, HOUSEHOLD, TEST_LADDER_PACK, TEST_PACKS } from '../testing.ts';

type Client = Socket<ServerToClientEvents, ClientToServerEvents>;

let url = '';
let store: MemoryStore;
let close: () => Promise<void>;
const clients: Client[] = [];

beforeEach(async () => {
  store = new MemoryStore(fixtureContent());
  // 2% of real phase lengths: a full game takes a few seconds.
  const { app } = await createApp({ store, logger: false, timingScale: 0.02, packs: [...TEST_PACKS, TEST_LADDER_PACK], minPackQuestions: 1 });
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
  socket.on('latency:probe', (_payload, ack) => ack(true));
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
    const created = await tv.emitWithAck('host:create', { householdId: HOUSEHOLD });
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
    const created = await tv.emitWithAck('host:create', { householdId: HOUSEHOLD });
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
    const created = await tv.emitWithAck('host:create', { householdId: HOUSEHOLD });
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

describe('a game over sockets', () => {
  async function lobbyWith(names: string[]) {
    const tv = await client();
    const created = await tv.emitWithAck('host:create', { householdId: HOUSEHOLD });
    if (!created.ok) throw new Error('create failed');
    const phones = [];
    for (const name of names) {
      const phone = await client();
      const joined = await phone.emitWithAck('player:join', { roomCode: created.roomCode, name });
      if (!joined.ok) throw new Error('join failed');
      phones.push({ phone, id: joined.playerId });
    }
    return { tv, phones, code: created.roomCode };
  }

  it('runs from VIP start to the final standings', async () => {
    const { tv, phones } = await lobbyWith(['Anna', 'Béla']);
    const [anna, bela] = phones;

    expect(await bela!.phone.emitWithAck('vip:start', {})).toEqual({ ok: false, error: 'NOT_ALLOWED' });

    // Every phone votes for the first option and answers choice 0 whenever asked.
    for (const { phone } of phones) {
      phone.on('view:player', (v) => {
        if (v.stage.phase === 'vote' && v.mine.vote === null) phone.emit('vote:cast', { option: 0 }, () => {});
        if (v.stage.phase === 'question_open' && v.mine.choice === null) {
          phone.emit('answer:submit', { questionId: v.stage.question.id, choice: 0 }, () => {});
        }
      });
    }
    const finalView = next(tv, 'view:host', (v) => v.stage.phase === 'final');
    expect(await anna!.phone.emitWithAck('vip:start', {})).toEqual({ ok: false, error: 'NO_QUESTIONS' });
    expect(await anna!.phone.emitWithAck('vip:lockPack', {})).toEqual({ ok: true });
    expect(await anna!.phone.emitWithAck('vip:start', {})).toEqual({ ok: true });
    const view = await finalView;
    if (view.stage.phase !== 'final') throw new Error();
    expect(view.round).toBe(10);
    expect(view.stage.standings).toHaveLength(2);
    expect(view.otto?.key === 'winner' || view.otto?.key === 'tie').toBe(true);
  }, 20_000);

  it('votes for a pack, locks it, and switches a category off before starting', async () => {
    const { tv, phones } = await lobbyWith(['Anna', 'Béla']);
    const [anna, bela] = phones;

    const tallied = next(tv, 'view:host', (v) => v.stage.phase === 'lobby' && v.stage.step === 'packs' && Object.keys(v.stage.votes).length === 1);
    expect(await bela!.phone.emitWithAck('pack:vote', { pack: 'minden' })).toEqual({ ok: true });
    expect(await bela!.phone.emitWithAck('pack:vote', { pack: 'nincs' })).toEqual({ ok: false, error: 'BAD_REQUEST' });
    const packs = await tallied;
    if (packs.stage.phase !== 'lobby' || packs.stage.step !== 'packs') throw new Error();
    expect(packs.stage.packs?.map((p) => p.slug)).toEqual(['minden', 'letra']);
    expect(packs.stage.votes).toEqual({ [bela!.id]: 'minden' });

    expect(await bela!.phone.emitWithAck('vip:lockPack', {})).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    const setup = next(bela!.phone, 'view:player', (v) => v.stage.phase === 'lobby' && v.stage.step === 'setup');
    expect(await anna!.phone.emitWithAck('vip:lockPack', {})).toEqual({ ok: true });
    const view = await setup;
    if (view.stage.phase !== 'lobby' || view.stage.step !== 'setup') throw new Error();
    expect(view.pack).toBe('Minden');
    expect(view.stage.categories.every((c) => c.enabled)).toBe(true);

    const off = next(tv, 'view:host', (v) => v.stage.phase === 'lobby' && v.stage.step === 'setup' && v.stage.categories.some((c) => !c.enabled));
    expect(await anna!.phone.emitWithAck('vip:setCategory', { categoryId: 2, enabled: false })).toEqual({ ok: true });
    await off;

    const inVote = next(tv, 'view:host', (v) => v.stage.phase === 'vote');
    expect(await anna!.phone.emitWithAck('vip:start', {})).toEqual({ ok: true });
    const vote = await inVote;
    if (vote.stage.phase !== 'vote') throw new Error();
    expect(vote.stage.options.map((o) => o.id)).not.toContain(2);
  });

  it('plays Milliomos-létra from the pack vote to the final', async () => {
    const { tv, phones } = await lobbyWith(['Anna', 'Béla']);
    const [anna] = phones;
    // Both keep climbing and always tap the first choice, until they fall.
    for (const { phone, id } of phones) {
      await phone.emitWithAck('pack:vote', { pack: 'letra' });
      phone.on('view:player', (v) => {
        const s = v.stage;
        if (s.phase === 'ladder_step' && s.rung > 1 && !(id in s.walking)) phone.emit('ladder:walk', { walk: false }, () => {});
        if (s.phase === 'question_open' && v.mine.choice === null) {
          phone.emit('answer:submit', { questionId: s.question.id, choice: 0 }, () => {});
        }
      });
    }
    expect(await anna!.phone.emitWithAck('vip:lockPack', {})).toEqual({ ok: true });
    const finalView = next(tv, 'view:host', (v) => v.stage.phase === 'final');
    expect(await anna!.phone.emitWithAck('vip:start', {})).toEqual({ ok: true });
    const view = await finalView;
    if (view.stage.phase !== 'final') throw new Error();
    expect(view.mode).toBe('ladder');
    expect(view.totalRounds).toBe(15);
    expect(view.stage.standings).toHaveLength(2);
    expect(view.ladder?.seats.every((s) => s.status !== 'in')).toBe(true);
  }, 20_000);

  it('lets the VIP kick a player, who is told so', async () => {
    const { tv, phones } = await lobbyWith(['Anna', 'Béla']);
    const [anna, bela] = phones;
    const closed = new Promise((resolve) => bela!.phone.on('room:closed', resolve));
    const tvSeesOne = next(tv, 'view:host', (v) => v.players.length === 1);
    expect(await anna!.phone.emitWithAck('vip:kick', { playerId: bela!.id })).toEqual({ ok: true });
    expect(await closed).toEqual({ reason: 'kicked' });
    await tvSeesOne;
  });

  it('pauses when the TV drops mid-game and resumes when it returns', async () => {
    const tv = await client();
    const created = await tv.emitWithAck('host:create', { householdId: HOUSEHOLD });
    if (!created.ok) throw new Error();
    const a = await client();
    const b = await client();
    await a.emitWithAck('player:join', { roomCode: created.roomCode, name: 'Anna' });
    await b.emitWithAck('player:join', { roomCode: created.roomCode, name: 'Béla' });
    const inVote = next(a, 'view:player', (v) => v.stage.phase === 'vote');
    await a.emitWithAck('vip:lockPack', {});
    await a.emitWithAck('vip:start', {});
    await inVote;

    const paused = next(a, 'view:player', (v) => v.paused);
    tv.disconnect();
    expect((await paused).phaseEndsAt).toBeNull();

    const tv2 = await client();
    const resumed = next(a, 'view:player', (v) => !v.paused);
    expect(await tv2.emitWithAck('host:resume', created)).toEqual({ ok: true });
    expect((await resumed).stage.phase).toBe('vote');
  });
});
