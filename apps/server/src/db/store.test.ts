import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadSeedFile } from '../content/seed.ts';
import * as schema from './schema.ts';
import { PgStore } from './store.ts';

// Runs only against a migrated test database, e.g.
// TEST_DATABASE_URL=postgres://trivia:trivia@localhost:5432/trivia_test
const url = process.env.TEST_DATABASE_URL;

describe.skipIf(!url)('PgStore', () => {
  const store = url ? new PgStore(url) : null!;
  const household = crypto.randomUUID();

  beforeAll(async () => {
    await store.seed(loadSeedFile());
    await store.touchHousehold(household);
  });
  afterAll(() => store.close());

  it('seeding is idempotent', async () => {
    const again = await store.seed(loadSeedFile());
    expect(again.questions).toBe(0);
  });

  it('offers playable categories and prefers unseen questions of the right difficulty', async () => {
    const cats = await store.pickCategories(household, 3, []);
    expect(cats).toHaveLength(3);
    const q = await store.pickQuestion(household, cats[0]!.id, 2, []);
    expect(q).not.toBeNull();
    expect(q!.difficulty).toBe(2);
    expect(q!.choices).toHaveLength(4);

    await store.markSeen(household, q!.id);
    const next = await store.pickQuestion(household, cats[0]!.id, 2, []);
    expect(next!.id).not.toBe(q!.id);
    expect(next!.difficulty).toBe(2);
  });

  it('counts questions per category and difficulty, and limits categories to the allowed ones', async () => {
    const counts = await store.countQuestions();
    const seed = loadSeedFile();
    const film = counts.find((c) => c.slug === 'film')!;
    // Other tests may retire questions, so at most what the seed holds.
    expect(film.counts[0]).toBeGreaterThan(0);
    expect(film.counts[0]).toBeLessThanOrEqual(seed.questions.filter((q) => q.category === 'film' && q.difficulty === 1).length);
    const cats = await store.pickCategories(household, 3, [], [film.id]);
    expect(cats.map((c) => c.id)).toEqual([film.id]);
  });

  it('never repeats a question excluded for this game', async () => {
    const [cat] = await store.pickCategories(household, 1, []);
    // Other tests may retire questions in this shared database, so don't
    // assume a count: draw until the category runs dry.
    const asked: string[] = [];
    for (let q = await store.pickQuestion(household, cat!.id, 1, asked); q; q = await store.pickQuestion(household, cat!.id, 1, asked)) {
      expect(asked).not.toContain(q.id);
      asked.push(q.id);
      if (asked.length > 500) throw new Error('never ran dry');
    }
    expect(asked.length).toBeGreaterThanOrEqual(10);
  });

  it('records a match and retires a question flagged in two matches', async () => {
    const [cat] = await store.pickCategories(household, 1, []);
    const q = (await store.pickQuestion(household, cat!.id, 3, []))!;
    const players = [
      { seat: 0, name: 'Anna', avatar: { color: 'teal' as const, face: 'grin' as const } },
      { seat: 1, name: 'Béla', avatar: { color: 'rust' as const, face: 'wink' as const } },
    ];
    const settings = { mode: 'classic' as const, pack: 'alap', categories: ['film'] };
    const m1 = await store.startMatch({ householdId: household, roomCode: 'BCDF', players, settings });
    const [row] = await store.db.select().from(schema.matches).where(eq(schema.matches.id, m1));
    expect(row?.settings).toEqual(settings);
    await store.recordRound({
      matchId: m1,
      round: 1,
      questionId: q.id,
      answers: [
        { seat: 0, choice: q.correct, correct: true, responseMs: 1200, points: 970 },
        { seat: 1, choice: null, correct: false, responseMs: null, points: 0 },
      ],
    });
    await store.finishMatch(m1, [
      { seat: 0, finalScore: 970, rank: 1 },
      { seat: 1, finalScore: 0, rank: 2 },
    ]);

    expect(await store.flagQuestion({ questionId: q.id, matchId: m1, playerName: 'Anna', reason: 'typo' })).toEqual({ retired: false });
    expect(await store.flagQuestion({ questionId: q.id, matchId: m1, playerName: 'Béla', reason: 'typo' })).toEqual({ retired: false });
    const m2 = await store.startMatch({ householdId: household, roomCode: 'GHJK', players });
    expect(await store.flagQuestion({ questionId: q.id, matchId: m2, playerName: 'Anna', reason: 'wrong_answer' })).toEqual({ retired: true });

    const retired = await store.pickQuestion(household, cat!.id, 3, []);
    expect(retired?.id).not.toBe(q.id);
  });
});
