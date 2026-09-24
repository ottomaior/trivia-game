import { FLAG_RETIRE_MATCHES, mcPayloadSchema, type Avatar, type Difficulty, type FlagReason } from '@trivia/shared';
import { and, eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { chooseCategories, type Rng } from '../content/select.ts';
import type { SeedData } from '../content/seed.ts';
import type { Category, CategoryStats, Question } from '../content/types.ts';
import * as schema from './schema.ts';

export interface MatchStart {
  householdId: string;
  roomCode: string;
  players: { seat: number; name: string; avatar: Avatar }[];
}

export interface RoundRecord {
  matchId: string;
  round: number;
  questionId: string;
  answers: { seat: number; choice: number | null; correct: boolean; responseMs: number | null; points: number }[];
}

export interface FlagRecord {
  questionId: string;
  matchId: string | null;
  playerName: string;
  reason: FlagReason;
}

/**
 * Everything the game needs from persistence. Calls happen at phase
 * boundaries and must never block gameplay: callers treat failures as
 * non-fatal.
 */
export interface Store {
  touchHousehold(householdId: string): Promise<void>;
  /** Up to `count` categories that have questions, freshest first. */
  pickCategories(householdId: string, count: number, exclude: number[]): Promise<Category[]>;
  /**
   * Best question for the slot: unseen by this household first, then closest
   * difficulty, then least recently seen. Null when the category is empty.
   */
  pickQuestion(
    householdId: string,
    categoryId: number,
    difficulty: Difficulty,
    exclude: string[],
  ): Promise<Question | null>;
  markSeen(householdId: string, questionId: string): Promise<void>;
  startMatch(match: MatchStart): Promise<string>;
  recordRound(record: RoundRecord): Promise<void>;
  finishMatch(matchId: string, results: { seat: number; finalScore: number; rank: number }[]): Promise<void>;
  /** Records a flag; returns whether the question got retired by it. */
  flagQuestion(flag: FlagRecord): Promise<{ retired: boolean }>;
  ping(): Promise<boolean>;
  close(): Promise<void>;
}

// ---------------------------------------------------------------------------

/** In-memory store for local play without a database, and for tests. */
export class MemoryStore implements Store {
  readonly households = new Set<string>();
  readonly seen = new Map<string, Map<string, number>>();
  readonly matches = new Map<string, { start: MatchStart; rounds: RoundRecord[]; finished: boolean }>();
  readonly flags: FlagRecord[] = [];
  readonly retired = new Set<string>();
  private readonly categories: Category[];
  private readonly questions: Question[];
  private seenCounter = 0;

  constructor(
    data: SeedData = { categories: [], questions: [] },
    private readonly rng: Rng = Math.random,
  ) {
    this.categories = data.categories;
    this.questions = data.questions;
  }

  async touchHousehold(householdId: string): Promise<void> {
    this.households.add(householdId);
  }

  async pickCategories(householdId: string, count: number, exclude: number[]): Promise<Category[]> {
    const seen = this.seen.get(householdId) ?? new Map();
    const stats: CategoryStats[] = this.categories.map((c) => {
      const qs = this.active().filter((q) => q.categoryId === c.id);
      return { ...c, total: qs.length, unseen: qs.filter((q) => !seen.has(q.id)).length };
    });
    return chooseCategories(stats, count, exclude, this.rng);
  }

  async pickQuestion(
    householdId: string,
    categoryId: number,
    difficulty: Difficulty,
    exclude: string[],
  ): Promise<Question | null> {
    const seen = this.seen.get(householdId) ?? new Map<string, number>();
    const candidates = this.active()
      .filter((q) => q.categoryId === categoryId && !exclude.includes(q.id))
      .map((q) => ({ q, r: this.rng() }));
    candidates.sort((a, b) => {
      const sa = seen.get(a.q.id);
      const sb = seen.get(b.q.id);
      if ((sa === undefined) !== (sb === undefined)) return sa === undefined ? -1 : 1;
      const d = Math.abs(a.q.difficulty - difficulty) - Math.abs(b.q.difficulty - difficulty);
      if (d !== 0) return d;
      if (sa !== undefined && sb !== undefined && sa !== sb) return sa - sb;
      return a.r - b.r;
    });
    return candidates[0]?.q ?? null;
  }

  async markSeen(householdId: string, questionId: string): Promise<void> {
    if (!this.seen.has(householdId)) this.seen.set(householdId, new Map());
    this.seen.get(householdId)!.set(questionId, ++this.seenCounter);
  }

  async startMatch(match: MatchStart): Promise<string> {
    const id = crypto.randomUUID();
    this.matches.set(id, { start: match, rounds: [], finished: false });
    return id;
  }

  async recordRound(record: RoundRecord): Promise<void> {
    this.matches.get(record.matchId)?.rounds.push(record);
  }

  async finishMatch(matchId: string): Promise<void> {
    const m = this.matches.get(matchId);
    if (m) m.finished = true;
  }

  async flagQuestion(flag: FlagRecord): Promise<{ retired: boolean }> {
    this.flags.push(flag);
    const matches = new Set(this.flags.filter((f) => f.questionId === flag.questionId).map((f) => f.matchId));
    if (matches.size >= FLAG_RETIRE_MATCHES && !this.retired.has(flag.questionId)) {
      this.retired.add(flag.questionId);
      return { retired: true };
    }
    return { retired: false };
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async close(): Promise<void> {}

  private active(): Question[] {
    return this.questions.filter((q) => !this.retired.has(q.id));
  }
}

// ---------------------------------------------------------------------------

export class PgStore implements Store {
  private readonly client: postgres.Sql;
  readonly db;

  constructor(
    url: string,
    private readonly rng: Rng = Math.random,
  ) {
    this.client = postgres(url, { max: 5, onnotice: () => {} });
    this.db = drizzle(this.client, { schema });
  }

  async touchHousehold(householdId: string): Promise<void> {
    await this.db
      .insert(schema.households)
      .values({ id: householdId })
      .onConflictDoUpdate({ target: schema.households.id, set: { lastSeenAt: sql`now()` } });
  }

  async pickCategories(householdId: string, count: number, exclude: number[]): Promise<Category[]> {
    const rows = await this.client<{ id: number; slug: string; name: string; total: number; unseen: number }[]>`
      select c.id, c.slug, c.name,
             count(q.id)::int as total,
             (count(q.id) filter (where hs.question_id is null))::int as unseen
      from categories c
      join questions q on q.category_id = c.id and q.status = 'active' and q.kind = 'mc'
      left join household_seen hs on hs.question_id = q.id and hs.household_id = ${householdId}
      where c.active
      group by c.id`;
    return chooseCategories(rows, count, exclude, this.rng);
  }

  async pickQuestion(
    householdId: string,
    categoryId: number,
    difficulty: Difficulty,
    exclude: string[],
  ): Promise<Question | null> {
    const rows = await this.client<
      { id: string; category_id: number; category: string; difficulty: number; prompt: string; payload: unknown; explanation: string | null }[]
    >`
      select q.id, q.category_id, c.name as category, q.difficulty, q.prompt, q.payload, q.explanation
      from questions q
      join categories c on c.id = q.category_id
      left join household_seen hs on hs.question_id = q.id and hs.household_id = ${householdId}
      where q.category_id = ${categoryId} and q.status = 'active' and q.kind = 'mc'
        and not (q.id = any(${exclude}::uuid[]))
      order by (hs.seen_at is not null), abs(q.difficulty - ${difficulty}), hs.seen_at nulls first, random()
      limit 1`;
    const row = rows[0];
    if (!row) return null;
    const payload = mcPayloadSchema.parse(row.payload);
    return {
      id: row.id,
      categoryId: row.category_id,
      category: row.category,
      difficulty: row.difficulty as Difficulty,
      prompt: row.prompt,
      choices: payload.choices,
      correct: payload.correct,
      explanation: row.explanation,
    };
  }

  async markSeen(householdId: string, questionId: string): Promise<void> {
    await this.db
      .insert(schema.householdSeen)
      .values({ householdId, questionId })
      .onConflictDoUpdate({
        target: [schema.householdSeen.householdId, schema.householdSeen.questionId],
        set: { seenAt: sql`now()` },
      });
  }

  async startMatch(match: MatchStart): Promise<string> {
    return this.db.transaction(async (tx) => {
      const [row] = await tx
        .insert(schema.matches)
        .values({ householdId: match.householdId, roomCode: match.roomCode })
        .returning({ id: schema.matches.id });
      const id = row!.id;
      if (match.players.length) {
        await tx.insert(schema.matchPlayers).values(match.players.map((p) => ({ matchId: id, ...p })));
      }
      return id;
    });
  }

  async recordRound(record: RoundRecord): Promise<void> {
    const correct = record.answers.filter((a) => a.correct).length;
    await this.db.transaction(async (tx) => {
      if (record.answers.length) {
        await tx
          .insert(schema.matchAnswers)
          .values(record.answers.map((a) => ({ ...a, matchId: record.matchId, round: record.round, questionId: record.questionId })))
          .onConflictDoNothing();
      }
      await tx
        .update(schema.questions)
        .set({
          timesShown: sql`${schema.questions.timesShown} + ${record.answers.length}`,
          timesCorrect: sql`${schema.questions.timesCorrect} + ${correct}`,
        })
        .where(eq(schema.questions.id, record.questionId));
    });
  }

  async finishMatch(matchId: string, results: { seat: number; finalScore: number; rank: number }[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      await tx.update(schema.matches).set({ endedAt: sql`now()` }).where(eq(schema.matches.id, matchId));
      for (const r of results) {
        await tx
          .update(schema.matchPlayers)
          .set({ finalScore: r.finalScore, rank: r.rank })
          .where(and(eq(schema.matchPlayers.matchId, matchId), eq(schema.matchPlayers.seat, r.seat)));
      }
    });
  }

  async flagQuestion(flag: FlagRecord): Promise<{ retired: boolean }> {
    return this.db.transaction(async (tx) => {
      const inserted = await tx
        .insert(schema.questionFlags)
        .values(flag)
        .onConflictDoNothing()
        .returning({ id: schema.questionFlags.id });
      if (!inserted.length) return { retired: false };
      await tx
        .update(schema.questions)
        .set({ flagCount: sql`${schema.questions.flagCount} + 1` })
        .where(eq(schema.questions.id, flag.questionId));
      const [{ n } = { n: 0 }] = await tx
        .select({ n: sql<number>`count(distinct coalesce(${schema.questionFlags.matchId}::text, ${schema.questionFlags.id}::text))::int` })
        .from(schema.questionFlags)
        .where(eq(schema.questionFlags.questionId, flag.questionId));
      if (n < FLAG_RETIRE_MATCHES) return { retired: false };
      const retired = await tx
        .update(schema.questions)
        .set({ status: 'retired' })
        .where(and(eq(schema.questions.id, flag.questionId), eq(schema.questions.status, 'active')))
        .returning({ id: schema.questions.id });
      return { retired: retired.length > 0 };
    });
  }

  /** Idempotently loads categories and questions (skips known ones by hash). */
  async seed(data: SeedFile): Promise<{ categories: number; questions: number }> {
    return this.db.transaction(async (tx) => {
      for (const c of data.categories) {
        await tx
          .insert(schema.categories)
          .values(c)
          .onConflictDoUpdate({ target: schema.categories.slug, set: { name: c.name } });
      }
      const cats = await tx.select().from(schema.categories);
      const idBySlug = new Map(cats.map((c) => [c.slug, c.id]));
      let added = 0;
      for (const q of data.questions) {
        const categoryId = idBySlug.get(q.category);
        if (!categoryId) throw new Error(`Unknown category ${q.category}`);
        const rows = await tx
          .insert(schema.questions)
          .values({
            categoryId,
            kind: 'mc',
            difficulty: q.difficulty,
            prompt: q.prompt,
            payload: { choices: [q.answer, ...q.wrong], correct: 0 },
            explanation: q.explanation ?? null,
            source: 'manual',
            sourceRef: 'seed',
            normHash: q.normHash,
          })
          .onConflictDoNothing()
          .returning({ id: schema.questions.id });
        added += rows.length;
      }
      return { categories: data.categories.length, questions: added };
    });
  }

  async ping(): Promise<boolean> {
    try {
      await this.client`select 1`;
      return true;
    } catch {
      return false;
    }
  }

  async close(): Promise<void> {
    await this.client.end({ timeout: 5 });
  }
}

export interface SeedFile {
  categories: { slug: string; name: string }[];
  questions: {
    category: string;
    difficulty: Difficulty;
    prompt: string;
    answer: string;
    wrong: [string, string, string];
    explanation?: string;
    normHash: string;
  }[];
}
