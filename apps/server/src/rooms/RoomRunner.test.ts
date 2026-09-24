import { TIMINGS, TOTAL_ROUNDS } from '@trivia/shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryStore } from '../db/store.ts';
import { toHostView, toPlayerView } from '../game/views.ts';
import { fixtureContent, HOUSEHOLD, seededRng, TEST_PACKS } from '../testing.ts';
import { Room } from './Room.ts';
import { RoomRunner } from './RoomRunner.ts';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(1_000_000);
});
afterEach(() => vi.useRealTimers());

function setup(opts: { players?: number; store?: MemoryStore } = {}) {
  const store = opts.store ?? new MemoryStore(fixtureContent(), seededRng(7));
  const room = new Room('BCDF', HOUSEHOLD, Date.now(), seededRng(3));
  const changes: string[] = [];
  const runner = new RoomRunner(room, {
    store,
    clock: () => Date.now(),
    rng: seededRng(5),
    packs: TEST_PACKS,
    minPackQuestions: 1,
    timingScale: 1,
    onChange: (r) => changes.push(r.phase),
    log: { warn: () => {} },
  });
  room.hostConnectedNow();
  const players = Array.from({ length: opts.players ?? 3 }, (_, i) => {
    const res = room.join(`P${i}`);
    if (!res.ok) throw new Error(res.error);
    return res.player;
  });
  return { store, room, runner, players, changes };
}

/** Lets pending promises (store calls) settle without moving time. */
const flush = () => vi.advanceTimersByTimeAsync(0);

/** Waits for the pack offers, locks the pack as the VIP, and starts the show. */
async function begin(runner: RoomRunner, vipId: string) {
  await flush();
  expect(runner.lockPack(vipId)).toEqual({ ok: true });
  return runner.start(vipId);
}

/** Advances fake time until the game reaches the final screen (max ~17 min). */
async function runToFinal(room: Room): Promise<void> {
  for (let i = 0; i < 1000 && room.phase !== 'final'; i++) await vi.advanceTimersByTimeAsync(1_000);
}

describe('RoomRunner', () => {
  it('only lets the VIP lock the pack and start, and only once a pack is locked', async () => {
    const { runner, room, players } = setup({ players: 2 });
    await flush();
    expect(room.packOffers?.map((o) => o.slug)).toEqual(['minden']);
    expect(runner.start(players[0]!.id)).toEqual({ ok: false, error: 'NO_QUESTIONS' });
    expect(runner.lockPack(players[1]!.id)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(runner.lockPack(players[0]!.id)).toEqual({ ok: true });
    expect(runner.start(players[1]!.id)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(runner.start(players[0]!.id)).toEqual({ ok: true });
  });

  it('plays solo: one player can start, and each question ends as soon as they answer', async () => {
    const { runner, room, players } = setup({ players: 1 });
    const [solo] = players;
    expect(await begin(runner, solo!.id)).toEqual({ ok: true });
    await vi.advanceTimersByTimeAsync(TIMINGS.intro);
    for (let round = 1; round <= TOTAL_ROUNDS; round++) {
      expect(room.phase).toBe('vote');
      runner.vote(solo!.id, 0);
      expect(room.phase).toBe('vote_result');
      await vi.advanceTimersByTimeAsync(TIMINGS.voteResult + TIMINGS.questionRead + 1_000);
      runner.answer(solo!.id, room.question!.id, room.question!.correct);
      expect(room.phase).toBe('reveal');
      await vi.advanceTimersByTimeAsync(TIMINGS.reveal + (round < TOTAL_ROUNDS ? TIMINGS.scoreboard : 0));
    }
    expect(room.phase).toBe('final');
    expect(room.standings).toEqual([expect.objectContaining({ playerId: solo!.id, rank: 1 })]);
    // Answered 1s into the 20s window every round; the last round scores double.
    expect(solo!.score).toBe((TOTAL_ROUNDS + 1) * 975);
    expect(room.otto?.key).toBe('soloFinalHigh');
  });

  it('plays a full game on timers alone and records it', async () => {
    const { runner, room, players, store } = setup();
    expect(await begin(runner, players[0]!.id)).toEqual({ ok: true });
    expect(room.phase).toBe('intro');
    await flush();

    const seenPhases = new Set<string>();
    for (let i = 0; i < 1000 && room.phase !== 'final'; i++) {
      seenPhases.add(room.phase);
      await vi.advanceTimersByTimeAsync(1_000);
    }
    expect(room.phase).toBe('final');
    expect(room.round).toBe(TOTAL_ROUNDS);
    expect([...seenPhases]).toEqual(['intro', 'vote', 'vote_result', 'question_read', 'question_open', 'reveal', 'scoreboard']);
    expect(room.askedQuestionIds.size).toBe(TOTAL_ROUNDS);

    await flush();
    const [match] = [...store.matches.values()];
    expect(match?.rounds).toHaveLength(TOTAL_ROUNDS);
    expect(match?.finished).toBe(true);
    expect(store.seen.get(HOUSEHOLD)?.size).toBe(TOTAL_ROUNDS);
  });

  it('ends vote and question phases early once everyone has acted', async () => {
    const { runner, room, players } = setup({ players: 2 });
    await begin(runner, players[0]!.id);
    await vi.advanceTimersByTimeAsync(TIMINGS.intro);
    expect(room.phase).toBe('vote');

    for (const p of players) runner.vote(p.id, 1);
    expect(room.phase).toBe('vote_result');
    expect(room.chosenOption).toBe(1);
    await vi.advanceTimersByTimeAsync(TIMINGS.voteResult);
    expect(room.phase).toBe('question_read');
    expect(room.question?.categoryId).toBe(room.voteOptions[1]!.category.id);

    await vi.advanceTimersByTimeAsync(TIMINGS.questionRead);
    expect(room.phase).toBe('question_open');
    const q = room.question!;
    await vi.advanceTimersByTimeAsync(4_000);
    runner.answer(players[0]!.id, q.id, q.correct);
    expect(room.phase).toBe('question_open');
    runner.answer(players[1]!.id, q.id, (q.correct + 1) % 4);
    expect(room.phase).toBe('reveal');
    expect(players[0]!.score).toBe(900); // 4s of 20s used
    expect(players[1]!.score).toBe(0);
  });

  it('never reveals the answer key before the reveal', async () => {
    const { runner, room, players } = setup({ players: 2 });
    await begin(runner, players[0]!.id);
    await vi.advanceTimersByTimeAsync(TIMINGS.intro);
    for (const p of players) runner.vote(p.id, 0);
    await vi.advanceTimersByTimeAsync(TIMINGS.voteResult);
    await vi.advanceTimersByTimeAsync(TIMINGS.questionRead);
    expect(room.phase).toBe('question_open');

    const views = [toHostView(room, Date.now()), toPlayerView(room, players[0]!.id, Date.now())];
    for (const v of views) {
      expect(JSON.stringify(v)).not.toMatch(/"correct"/);
      expect(v?.stage.phase).toBe('question_open');
    }
    runner.answer(players[0]!.id, room.question!.id, 0);
    runner.answer(players[1]!.id, room.question!.id, 1);
    const reveal = toHostView(room, Date.now()).stage;
    expect(reveal.phase === 'reveal' && reveal.correct).toBe(room.question!.correct);
  });

  it('shuffles answer positions across rounds', async () => {
    const { runner, room, players } = setup({ players: 2 });
    await begin(runner, players[0]!.id);
    await vi.advanceTimersByTimeAsync(TIMINGS.intro);
    const positions = new Set<number>();
    for (let i = 0; i < 6; i++) {
      for (const p of players) runner.vote(p.id, 0);
      await vi.advanceTimersByTimeAsync(TIMINGS.voteResult);
      positions.add(room.question!.correct);
      await vi.advanceTimersByTimeAsync(TIMINGS.questionRead);
      for (const p of players) runner.answer(p.id, room.question!.id, 0);
      await vi.advanceTimersByTimeAsync(TIMINGS.reveal + TIMINGS.scoreboard);
    }
    expect(positions.size).toBeGreaterThan(1);
  });

  it('freezes the clock while the TV is away and resumes where it left off', async () => {
    const { runner, room, players } = setup({ players: 2 });
    await begin(runner, players[0]!.id);
    await vi.advanceTimersByTimeAsync(TIMINGS.intro);
    for (const p of players) runner.vote(p.id, 0);
    await vi.advanceTimersByTimeAsync(TIMINGS.voteResult);
    await vi.advanceTimersByTimeAsync(TIMINGS.questionRead + 5_000);
    expect(room.phase).toBe('question_open');

    runner.hostLeft();
    expect(room.paused).toBe(true);
    expect(room.phaseEndsAt).toBeNull();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(room.phase).toBe('question_open');

    runner.hostBack();
    expect(room.paused).toBe(false);
    expect(room.phaseEndsAt).toBe(Date.now() + 15_000);
    // The minute away does not count against answer time.
    runner.answer(players[0]!.id, room.question!.id, room.question!.correct);
    expect(room.answers.get(players[0]!.id)?.responseMs).toBe(5_000);
  });

  it('finishes early with what it has when questions run out', async () => {
    const store = new MemoryStore(fixtureContent(3, 1), seededRng(2));
    const { runner, room, players } = setup({ players: 2, store });
    await begin(runner, players[0]!.id);
    for (let i = 0; i < 50 && room.phase !== 'final'; i++) await vi.advanceTimersByTimeAsync(5_000);
    expect(room.phase).toBe('final');
    expect(room.round).toBe(3);
  });

  it('prefers unseen questions in the next game from the same TV', async () => {
    const store = new MemoryStore(fixtureContent(4, 12), seededRng(9));
    const first = setup({ players: 2, store });
    await begin(first.runner, first.players[0]!.id);
    await runToFinal(first.room);
    const firstGame = new Set(first.room.askedQuestionIds);

    const second = setup({ players: 2, store });
    await begin(second.runner, second.players[0]!.id);
    await runToFinal(second.room);
    const overlap = [...second.room.askedQuestionIds].filter((id) => firstGame.has(id));
    expect(overlap).toEqual([]);
  });

  it('records flags once per player and retires after flags from two matches', async () => {
    const store = new MemoryStore(fixtureContent(), seededRng(4));
    const { runner, room, players } = setup({ players: 2, store });
    await begin(runner, players[0]!.id);
    await vi.advanceTimersByTimeAsync(TIMINGS.intro);
    for (const p of players) runner.vote(p.id, 0);
    await vi.advanceTimersByTimeAsync(TIMINGS.voteResult);
    const qid = room.question!.id;
    expect(runner.flag(players[0]!.id, qid, 'typo')).toEqual({ ok: false, error: 'NOT_ALLOWED' }); // not before reveal
    await vi.advanceTimersByTimeAsync(TIMINGS.questionRead + TIMINGS.questionOpen);
    expect(room.phase).toBe('reveal');
    expect(runner.flag(players[0]!.id, qid, 'wrong_answer')).toEqual({ ok: true });
    expect(runner.flag(players[0]!.id, qid, 'wrong_answer')).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(runner.flag(players[1]!.id, qid, 'ambiguous')).toEqual({ ok: true });
    await flush();
    expect(store.flags).toHaveLength(2);
    expect(store.retired.has(qid)).toBe(false); // same match twice
    await store.flagQuestion({ questionId: qid, matchId: 'another-match', playerName: 'X', reason: 'typo' });
    expect(store.retired.has(qid)).toBe(true);
  });

  it('play again resets scores; new lobby returns everyone to the lobby', async () => {
    const { runner, room, players } = setup({ players: 2 });
    await begin(runner, players[0]!.id);
    await runToFinal(room);
    players[0]!.score = 1234;
    expect(runner.newLobby(players[1]!.id)).toEqual({ ok: false, error: 'NOT_ALLOWED' });
    expect(runner.start(players[0]!.id)).toEqual({ ok: true });
    expect(room.phase).toBe('intro');
    expect(players[0]!.score).toBe(0);
    await runToFinal(room);
    expect(runner.newLobby(players[0]!.id)).toEqual({ ok: true });
    expect(room.phase).toBe('lobby');
    expect(room.lobbyStep).toBe('packs');
    expect(room.pack).toBeNull();
    expect(runner.start(players[0]!.id)).toEqual({ ok: false, error: 'NO_QUESTIONS' });
  });

  it('asks only the categories left switched on, and records the pack with the match', async () => {
    const { runner, room, players, store } = setup({ players: 2 });
    await flush();
    const vip = players[0]!.id;
    expect(runner.votePack(players[1]!.id, 'minden')).toEqual({ ok: true });
    expect(runner.lockPack(vip)).toEqual({ ok: true });
    expect(runner.setCategory(vip, 4, false)).toEqual({ ok: true });
    // 48 fixture questions: switching off a second category would leave 24.
    expect(runner.setCategory(vip, 3, false)).toEqual({ ok: false, error: 'TOO_FEW_QUESTIONS' });
    expect(runner.start(vip)).toEqual({ ok: true });

    const offered = new Set<number>();
    for (let i = 0; i < 1000 && room.phase !== 'final'; i++) {
      for (const o of room.voteOptions) offered.add(o.category.id);
      await vi.advanceTimersByTimeAsync(1_000);
    }
    expect(room.phase).toBe('final');
    expect([...offered].sort()).toEqual([1, 2, 3]);

    await flush();
    const [match] = [...store.matches.values()];
    expect(match?.start.settings).toEqual({ mode: 'classic', pack: 'minden', categories: ['c1', 'c2', 'c3'] });
  });

  it('skips the vote when only one category is switched on', async () => {
    const store = new MemoryStore(fixtureContent(2, 40), seededRng(6));
    const { runner, room, players } = setup({ players: 2, store });
    await flush();
    const vip = players[0]!.id;
    runner.lockPack(vip);
    expect(runner.setCategory(vip, 2, false)).toEqual({ ok: true });
    runner.start(vip);
    await vi.advanceTimersByTimeAsync(TIMINGS.intro);
    expect(room.phase).toBe('vote_result');
    expect(room.voteOptions.map((o) => o.category.id)).toEqual([1]);
    await vi.advanceTimersByTimeAsync(TIMINGS.voteResult);
    expect(room.question?.categoryId).toBe(1);
  });

  it('reopens the pack vote with fresh offers after a new lobby', async () => {
    const store = new MemoryStore(fixtureContent(), seededRng(8));
    const { runner, room, players } = setup({ players: 1, store });
    await begin(runner, players[0]!.id);
    await runToFinal(room);
    store.retired.add('q-1-0');
    expect(runner.newLobby(players[0]!.id)).toEqual({ ok: true });
    await flush();
    expect(room.packOffers?.[0]?.questions).toBe(47);
  });
});
