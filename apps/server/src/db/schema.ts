import { sql } from 'drizzle-orm';
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  real,
  serial,
  smallint,
  text,
  timestamp,
  unique,
  uuid,
} from 'drizzle-orm/pg-core';

// Content and history only. Live game state never touches the database.

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

export const categories = pgTable('categories', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  nameHu: text('name_hu').notNull(),
  nameEn: text('name_en').notNull(),
  active: boolean('active').notNull().default(true),
});

export const generationBatches = pgTable('generation_batches', {
  id: uuid('id').primaryKey().defaultRandom(),
  model: text('model').notNull(),
  promptVersion: text('prompt_version').notNull(),
  lang: text('lang').notNull(),
  categoryId: integer('category_id').references(() => categories.id),
  difficulty: smallint('difficulty'),
  requested: integer('requested').notNull(),
  accepted: integer('accepted').notNull().default(0),
  rejected: integer('rejected').notNull().default(0),
  inputTokens: integer('input_tokens').notNull().default(0),
  outputTokens: integer('output_tokens').notNull().default(0),
  createdAt: createdAt(),
});

export const questions = pgTable(
  'questions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    lang: text('lang').notNull(),
    categoryId: integer('category_id')
      .notNull()
      .references(() => categories.id),
    kind: text('kind').notNull().default('mc'),
    difficulty: smallint('difficulty').notNull(),
    prompt: text('prompt').notNull(),
    /** mc: {choices: string[4], correct: number}; link/sort shapes added later. */
    payload: jsonb('payload').notNull(),
    explanation: text('explanation'),
    source: text('source').notNull(),
    /** Generation batch id, or attribution for imported questions. */
    sourceRef: text('source_ref'),
    status: text('status').notNull().default('active'),
    verifierScore: real('verifier_score'),
    flagCount: integer('flag_count').notNull().default(0),
    timesShown: integer('times_shown').notNull().default(0),
    timesCorrect: integer('times_correct').notNull().default(0),
    normHash: text('norm_hash').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check('questions_lang_check', sql`${t.lang} in ('hu', 'en')`),
    check('questions_kind_check', sql`${t.kind} in ('mc', 'link', 'sort')`),
    check('questions_difficulty_check', sql`${t.difficulty} between 1 and 3`),
    check('questions_source_check', sql`${t.source} in ('claude', 'opentdb', 'manual')`),
    check('questions_status_check', sql`${t.status} in ('active', 'retired')`),
    unique('questions_lang_norm_hash_unique').on(t.lang, t.normHash),
    index('questions_selection_idx').on(t.lang, t.categoryId, t.kind, t.status, t.difficulty),
    index('questions_prompt_trgm_idx').using('gin', sql`${t.prompt} gin_trgm_ops`),
  ],
);

export const households = pgTable('households', {
  id: uuid('id').primaryKey(),
  createdAt: createdAt(),
  lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).notNull().defaultNow(),
});

export const householdSeen = pgTable(
  'household_seen',
  {
    householdId: uuid('household_id')
      .notNull()
      .references(() => households.id, { onDelete: 'cascade' }),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    seenAt: timestamp('seen_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [primaryKey({ columns: [t.householdId, t.questionId] })],
);

export const matches = pgTable('matches', {
  id: uuid('id').primaryKey().defaultRandom(),
  householdId: uuid('household_id')
    .notNull()
    .references(() => households.id),
  roomCode: text('room_code').notNull(),
  lang: text('lang').notNull(),
  settings: jsonb('settings').notNull().default({}),
  startedAt: timestamp('started_at', { withTimezone: true }).notNull().defaultNow(),
  endedAt: timestamp('ended_at', { withTimezone: true }),
});

export const matchPlayers = pgTable(
  'match_players',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    seat: smallint('seat').notNull(),
    name: text('name').notNull(),
    avatar: jsonb('avatar').notNull(),
    finalScore: integer('final_score'),
    rank: smallint('rank'),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.seat] })],
);

export const matchAnswers = pgTable(
  'match_answers',
  {
    matchId: uuid('match_id')
      .notNull()
      .references(() => matches.id, { onDelete: 'cascade' }),
    round: smallint('round').notNull(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id),
    seat: smallint('seat').notNull(),
    choice: smallint('choice'),
    correct: boolean('correct').notNull(),
    responseMs: integer('response_ms'),
    points: integer('points').notNull(),
  },
  (t) => [primaryKey({ columns: [t.matchId, t.round, t.seat] })],
);

export const questionFlags = pgTable(
  'question_flags',
  {
    id: serial('id').primaryKey(),
    questionId: uuid('question_id')
      .notNull()
      .references(() => questions.id, { onDelete: 'cascade' }),
    matchId: uuid('match_id').references(() => matches.id, { onDelete: 'set null' }),
    playerName: text('player_name').notNull(),
    reason: text('reason').notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    check(
      'question_flags_reason_check',
      sql`${t.reason} in ('wrong_answer', 'ambiguous', 'typo', 'offensive', 'other')`,
    ),
    unique('question_flags_once_per_match').on(t.questionId, t.matchId, t.playerName),
  ],
);
