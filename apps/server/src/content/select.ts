import type { Category, CategoryStats, Question } from './types.ts';

export type Rng = () => number;

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/**
 * Picks vote options: categories with unseen questions first, never the
 * excluded ones (e.g. last round's) unless there is nothing else.
 */
export function chooseCategories(
  stats: CategoryStats[],
  count: number,
  exclude: number[],
  rng: Rng,
): Category[] {
  const playable = stats.filter((c) => c.total > 0);
  const preferred = playable.filter((c) => !exclude.includes(c.id));
  const pool = preferred.length >= count ? preferred : playable;
  const fresh = shuffle(
    pool.filter((c) => c.unseen > 0),
    rng,
  );
  const stale = shuffle(
    pool.filter((c) => c.unseen === 0),
    rng,
  );
  return [...fresh, ...stale].slice(0, count).map(({ id, slug, name }) => ({ id, slug, name }));
}

/** Shuffles the answer order so position carries no information. */
export function shuffleChoices(q: Question, rng: Rng): Question {
  const order = shuffle(
    q.choices.map((_, i) => i),
    rng,
  );
  return { ...q, choices: order.map((i) => q.choices[i]!), correct: order.indexOf(q.correct) };
}
