import {
  authoredBluffSchema,
  authoredNumberSchema,
  authoredQuestionSchema,
  authoredTimelineSchema,
  BLUFF_TOO_CLOSE,
  type AuthoredBluff,
  type AuthoredNumber,
  type AuthoredQuestion,
  type AuthoredTimeline,
  type Difficulty,
  type QuestionKind,
} from '@trivia/shared';
import { z } from 'zod';
import bluffJson from '../../seed/bluff.json' with { type: 'json' };
import categoriesJson from '../../seed/categories.json' with { type: 'json' };
import numbersJson from '../../seed/numbers.json' with { type: 'json' };
import questionsJson from '../../seed/questions.json' with { type: 'json' };
import timelineJson from '../../seed/timeline.json' with { type: 'json' };
import { normalizeText, questionHash, similarity } from './normalize.ts';
import type { Category, Question } from './types.ts';

// The hand-written question sets that ship with the game: multiple choice
// (questions.json) plus one file per party mode (bluff, timeline, numbers).

const categoriesSchema = z.array(z.object({ slug: z.string().min(1), name: z.string().min(1) }));

type Hashed<T> = T & { normHash: string };

export interface SeedFile {
  categories: { slug: string; name: string }[];
  questions: Hashed<AuthoredQuestion>[];
  bluff: Hashed<AuthoredBluff>[];
  timeline: Hashed<AuthoredTimeline>[];
  numbers: Hashed<AuthoredNumber>[];
}

/** Raw file contents, so tests can check a broken file without touching the real ones. */
export interface SeedSources {
  categories: unknown;
  questions: unknown;
  bluff: unknown;
  timeline: unknown;
  numbers: unknown;
}

const BUNDLED: SeedSources = {
  categories: categoriesJson,
  questions: questionsJson,
  bluff: bluffJson,
  timeline: timelineJson,
  numbers: numbersJson,
};

export interface SeedData {
  categories: Category[];
  questions: Question[];
}

/** Longest ending (a Hungarian suffix: "kockák", "kockás") that still counts as the same word. */
const SUFFIX_CHARS = 3;
/** Words shorter than this are compared exactly, so "Pál" doesn't swallow "Pálma". */
const SUFFIX_MIN_STEM = 4;

/** True when a lie would read as the truth: the same words, nearly so, or the truth with an ending. */
export function tooCloseToTruth(lie: string, truths: readonly string[]): boolean {
  const n = normalizeText(lie);
  return truths.some((truth) => {
    const t = normalizeText(truth);
    if (t === n || similarity(lie, truth) > BLUFF_TOO_CLOSE) return true;
    const [short, long] = t.length <= n.length ? [t, n] : [n, t];
    return short.length >= SUFFIX_MIN_STEM && long.startsWith(short) && long.length - short.length <= SUFFIX_CHARS;
  });
}

/** Validates the bundled seed files; throws with a precise message if broken. */
export function loadSeedFile(sources: SeedSources = BUNDLED): SeedFile {
  const categories = categoriesSchema.parse(sources.categories);
  const slugs = new Set(categories.map((c) => c.slug));
  const hashes = new Set<string>();
  const check = (file: string, i: number, category: string, prompt: string, answer: string): string => {
    if (!slugs.has(category)) throw new Error(`${file} #${i}: unknown category "${category}"`);
    const normHash = questionHash(prompt, answer);
    if (hashes.has(normHash)) throw new Error(`${file} #${i}: duplicate of an earlier question`);
    hashes.add(normHash);
    return normHash;
  };

  const questions = z.array(authoredQuestionSchema).parse(sources.questions).map((q, i) => {
    const choices = [q.answer, ...q.wrong].map((s) => s.toLocaleLowerCase('hu'));
    if (new Set(choices).size !== 4) throw new Error(`questions #${i}: duplicate choices`);
    return { ...q, normHash: check('questions', i, q.category, q.prompt, q.answer) };
  });

  const bluff = parseFile('bluff', authoredBluffSchema, sources.bluff).map((q, i) => {
    const truths = [q.answer, ...(q.alternates ?? [])];
    if (new Set(truths.map(normalizeText)).size !== truths.length) throw new Error(`bluff #${i}: an alternate repeats the answer`);
    for (const d of q.decoys) {
      if (tooCloseToTruth(d, truths)) throw new Error(`bluff #${i}: the decoy "${d}" is too close to the truth`);
    }
    if (normalizeText(q.decoys[0]) === normalizeText(q.decoys[1])) throw new Error(`bluff #${i}: the two decoys are the same`);
    return { ...q, normHash: check('bluff', i, q.category, q.prompt, q.answer) };
  });

  const timeline = parseFile('timeline', authoredTimelineSchema, sources.timeline).map((q, i) => ({
    ...q,
    normHash: check('timeline', i, q.category, q.prompt, q.items.map((it) => it.text).join('|')),
  }));

  const numbers = parseFile('numbers', authoredNumberSchema, sources.numbers).map((q, i) => ({
    ...q,
    normHash: check('numbers', i, q.category, q.prompt, String(q.answer)),
  }));

  return { categories, questions, bluff, timeline, numbers };
}

/** Parses one seed file, naming the file and entry in the error. */
function parseFile<S extends z.ZodType>(file: string, schema: S, raw: unknown): z.infer<S>[] {
  const res = z.array(schema).safeParse(raw);
  if (res.success) return res.data;
  const issue = res.error.issues[0]!;
  throw new Error(`${file} #${String(issue.path[0])}: ${issue.message} (at ${issue.path.join('.')})`);
}

/** One row of the questions table, as seeding writes it. */
export interface SeedEntry {
  kind: QuestionKind;
  category: string;
  difficulty: Difficulty;
  prompt: string;
  payload: unknown;
  explanation: string | null;
  normHash: string;
}

/** Every seed question as a database row, whatever its kind. */
export function seedEntries(file: SeedFile): SeedEntry[] {
  const base = (q: { category: string; difficulty: Difficulty; prompt: string; explanation?: string; normHash: string }) => ({
    category: q.category,
    difficulty: q.difficulty,
    prompt: q.prompt,
    explanation: q.explanation ?? null,
    normHash: q.normHash,
  });
  return [
    ...file.questions.map((q) => ({ ...base(q), kind: 'mc' as const, payload: { choices: [q.answer, ...q.wrong], correct: 0 } })),
    ...file.bluff.map((q) => ({
      ...base(q),
      kind: 'bluff' as const,
      payload: { answer: q.answer, alternates: q.alternates ?? [], decoys: q.decoys },
    })),
    ...file.timeline.map((q) => ({ ...base(q), kind: 'timeline' as const, payload: { items: q.items } })),
    ...file.numbers.map((q) => ({ ...base(q), kind: 'number' as const, payload: { answer: q.answer, unit: q.unit ?? null } })),
  ];
}

/** The seed as in-memory playable data (for running without a database). */
export function seedData(file: SeedFile = loadSeedFile()): SeedData {
  const categories = file.categories.map((c, i) => ({ id: i + 1, ...c }));
  const bySlug = new Map(categories.map((c) => [c.slug, c]));
  const base = (id: string, q: { category: string; difficulty: Difficulty; prompt: string; explanation?: string }) => {
    const cat = bySlug.get(q.category)!;
    return { id, categoryId: cat.id, category: cat.name, difficulty: q.difficulty, prompt: q.prompt, explanation: q.explanation ?? null };
  };
  const questions: Question[] = [
    ...file.questions.map((q, i): Question => ({ ...base(`seed-${i}`, q), kind: 'mc', choices: [q.answer, ...q.wrong], correct: 0 })),
    ...file.bluff.map((q, i): Question => ({
      ...base(`seed-bluff-${i}`, q),
      kind: 'bluff',
      answer: q.answer,
      alternates: q.alternates ?? [],
      decoys: q.decoys,
    })),
    ...file.timeline.map((q, i): Question => ({ ...base(`seed-timeline-${i}`, q), kind: 'timeline', items: q.items })),
    ...file.numbers.map((q, i): Question => ({ ...base(`seed-number-${i}`, q), kind: 'number', answer: q.answer, unit: q.unit ?? null })),
  ];
  return { categories, questions };
}
