import { describe, expect, it } from 'vitest';
import { seededRng } from '../testing.ts';
import { loadSeedFile } from './seed.ts';
import { chooseCategories, shuffleChoices } from './select.ts';
import { normalizeText, questionHash, similarity } from './normalize.ts';

const stat = (id: number, total: number, unseen: number) => ({ id, slug: `c${id}`, name: `C${id}`, total, unseen });

describe('chooseCategories', () => {
  it('prefers categories with unseen questions and skips the excluded one', () => {
    const picked = chooseCategories([stat(1, 5, 0), stat(2, 5, 3), stat(3, 5, 3), stat(4, 5, 3), stat(5, 0, 0)], 3, [2], seededRng());
    expect(picked.map((c) => c.id).sort()).toEqual([1, 3, 4]);
    expect(picked[2]!.id).toBe(1); // the stale one comes last
  });

  it('falls back to excluded categories when there are too few', () => {
    const picked = chooseCategories([stat(1, 5, 5), stat(2, 5, 5)], 3, [1], seededRng());
    expect(picked).toHaveLength(2);
  });

  it('only offers the allowed categories (the game’s pack)', () => {
    const stats = [stat(1, 5, 5), stat(2, 5, 5), stat(3, 5, 5), stat(4, 5, 5)];
    const picked = chooseCategories(stats, 3, [2], seededRng(), [2, 4]);
    expect(picked.map((c) => c.id).sort()).toEqual([2, 4]);
  });
});

describe('shuffleChoices', () => {
  it('keeps the correct answer pointing at the same text', () => {
    const q = { id: 'x', categoryId: 1, category: 'c', difficulty: 1 as const, prompt: 'p', choices: ['a', 'b', 'c', 'd'], correct: 2, explanation: null };
    for (let seed = 1; seed < 20; seed++) {
      const s = shuffleChoices(q, seededRng(seed));
      expect(s.choices[s.correct]).toBe('c');
      expect([...s.choices].sort()).toEqual(['a', 'b', 'c', 'd']);
    }
  });
});

describe('normalization', () => {
  it('ignores case, accents and punctuation', () => {
    expect(normalizeText('  Hány  ország? ')).toBe('hany orszag');
    expect(questionHash('Mi a fővárosa?', 'Budapest')).toBe(questionHash('mi a FOVAROSA', 'budapest!'));
  });

  it('scores near-identical prompts as similar and unrelated ones as not', () => {
    expect(similarity('Ki írta a Himnusz szövegét?', 'Ki írta a magyar Himnusz szövegét?')).toBeGreaterThan(0.6);
    expect(similarity('Ki írta a Himnusz szövegét?', 'Melyik a legmélyebb tó?')).toBeLessThan(0.2);
  });
});

describe('seed file', () => {
  it('is valid and has every stocked category at every difficulty', () => {
    const seed = loadSeedFile();
    // A category without questions yet is simply never offered.
    const stocked = seed.categories.filter((c) => seed.questions.some((q) => q.category === c.slug));
    expect(stocked.length).toBeGreaterThanOrEqual(8);
    for (const c of stocked) {
      for (const d of [1, 2, 3]) {
        expect(seed.questions.filter((q) => q.category === c.slug && q.difficulty === d).length).toBeGreaterThanOrEqual(4);
      }
    }
  });
});
