import type { QuestionKind } from '@trivia/shared';
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

/**
 * `perCategory` questions of each kind in each of `categories` categories.
 * Multiple choice: the answer is always choice 0. Blöffölő: the truth is
 * "igazság j". Időrend: five items, a year apart. Tippelj!: the answer is j×10.
 */
export function fixtureContent(categories = 4, perCategory = 12, kinds: QuestionKind[] = ['mc']): SeedData {
  const cats = Array.from({ length: categories }, (_, i) => ({ id: i + 1, slug: `c${i + 1}`, name: `Kategória ${i + 1}` }));
  const questions: Question[] = kinds.flatMap((kind) =>
    cats.flatMap((c) =>
      Array.from({ length: perCategory }, (_, j): Question => {
        const base = {
          id: kind === 'mc' ? `q-${c.id}-${j}` : `${kind}-${c.id}-${j}`,
          categoryId: c.id,
          category: c.name,
          difficulty: ((j % 3) + 1) as 1 | 2 | 3,
          prompt: `${c.name} ${kind} kérdés ${j}`,
          explanation: null,
        };
        switch (kind) {
          case 'mc':
            return { ...base, prompt: `${c.name} kérdés ${j}`, kind, choices: [`jó ${j}`, `rossz a ${j}`, `rossz b ${j}`, `rossz c ${j}`], correct: 0 };
          case 'bluff':
            return { ...base, kind, answer: `igazság ${j}`, alternates: [], decoys: [`házi kamu ${j}`, `másik kamu ${j}`] };
          case 'timeline':
            return { ...base, kind, items: Array.from({ length: 5 }, (_, k) => ({ text: `esemény ${j}-${k}`, year: 2000 + k })) };
          case 'number':
            return { ...base, kind, answer: j * 10, unit: 'db' };
        }
      }),
    ),
  );
  return { categories: cats, questions };
}

/** One pack holding every fixture category. */
export const TEST_PACKS: PackDef[] = [
  { slug: 'minden', name: 'Minden', description: 'Minden kategória.', mode: 'classic', categories: '*' },
];

/** Milliomos-létra over every fixture category. */
export const TEST_LADDER_PACK: PackDef = {
  slug: 'letra',
  name: 'Létra',
  description: 'Milliomos-létra.',
  mode: 'ladder',
  categories: '*',
};

/** Blöffölő over every fixture category. */
export const TEST_BLUFF_PACK: PackDef = { slug: 'blof', name: 'Blöff', description: 'Blöffölő.', mode: 'bluff', categories: '*' };

/** Időrend over every fixture category. */
export const TEST_TIMELINE_PACK: PackDef = { slug: 'rend', name: 'Rend', description: 'Időrend.', mode: 'timeline', categories: '*' };

/** Tippelj! over every fixture category. */
export const TEST_GUESS_PACK: PackDef = { slug: 'tipp', name: 'Tipp', description: 'Tippelj!', mode: 'guess', categories: '*' };
