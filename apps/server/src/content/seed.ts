import { authoredQuestionSchema, type Difficulty } from '@trivia/shared';
import { z } from 'zod';
import categoriesJson from '../../seed/categories.json' with { type: 'json' };
import questionsJson from '../../seed/questions.json' with { type: 'json' };
import type { SeedFile } from '../db/store.ts';
import { questionHash } from './normalize.ts';
import type { Category, Question } from './types.ts';

// The hand-written starter question set that ships with the game, so it is
// playable before any AI generation has run.

const categoriesSchema = z.array(z.object({ slug: z.string().min(1), name: z.string().min(1) }));

export interface SeedData {
  categories: Category[];
  questions: Question[];
}

/** Validates the bundled seed files; throws with a precise message if broken. */
export function loadSeedFile(): SeedFile {
  const categories = categoriesSchema.parse(categoriesJson);
  const slugs = new Set(categories.map((c) => c.slug));
  const questions = z.array(authoredQuestionSchema).parse(questionsJson);
  const hashes = new Set<string>();
  return {
    categories,
    questions: questions.map((q, i) => {
      if (!slugs.has(q.category)) throw new Error(`Seed question ${i}: unknown category "${q.category}"`);
      const choices = [q.answer, ...q.wrong].map((s) => s.toLocaleLowerCase('hu'));
      if (new Set(choices).size !== 4) throw new Error(`Seed question ${i}: duplicate choices`);
      const normHash = questionHash(q.prompt, q.answer);
      if (hashes.has(normHash)) throw new Error(`Seed question ${i}: duplicate of an earlier question`);
      hashes.add(normHash);
      return { ...q, normHash };
    }),
  };
}

/** The seed as in-memory playable data (for running without a database). */
export function seedData(file: SeedFile = loadSeedFile()): SeedData {
  const categories = file.categories.map((c, i) => ({ id: i + 1, ...c }));
  const idBySlug = new Map(categories.map((c) => [c.slug, c]));
  const questions = file.questions.map((q, i): Question => {
    const cat = idBySlug.get(q.category)!;
    return {
      id: `seed-${i}`,
      categoryId: cat.id,
      category: cat.name,
      difficulty: q.difficulty as Difficulty,
      prompt: q.prompt,
      choices: [q.answer, ...q.wrong],
      correct: 0,
      explanation: q.explanation ?? null,
    };
  });
  return { categories, questions };
}
