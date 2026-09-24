import type { PackDef } from './content/packs.ts';
import type { SeedData } from './content/seed.ts';
import type { Question } from './content/types.ts';

// Shared fixtures for unit tests.

export const HOUSEHOLD = '6f1c1c2e-8d2b-4f7a-9a51-0c7a0c9b1d11';

/** Deterministic PRNG (mulberry32). */
export function seededRng(seed = 1): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** `perCategory` questions in each of `categories` categories; answer is always choice 0. */
export function fixtureContent(categories = 4, perCategory = 12): SeedData {
  const cats = Array.from({ length: categories }, (_, i) => ({ id: i + 1, slug: `c${i + 1}`, name: `Kategória ${i + 1}` }));
  const questions: Question[] = cats.flatMap((c) =>
    Array.from({ length: perCategory }, (_, j) => ({
      id: `q-${c.id}-${j}`,
      categoryId: c.id,
      category: c.name,
      difficulty: ((j % 3) + 1) as 1 | 2 | 3,
      prompt: `${c.name} kérdés ${j}`,
      choices: [`jó ${j}`, `rossz a ${j}`, `rossz b ${j}`, `rossz c ${j}`],
      correct: 0,
      explanation: null,
    })),
  );
  return { categories: cats, questions };
}

/** One pack holding every fixture category. */
export const TEST_PACKS: PackDef[] = [
  { slug: 'minden', name: 'Minden', description: 'Minden kategória.', mode: 'classic', categories: '*' },
];
