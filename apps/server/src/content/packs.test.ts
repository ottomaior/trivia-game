import { PACK_MIN_QUESTIONS } from '@trivia/shared';
import { describe, expect, it } from 'vitest';
import { buildOffers, loadPacks } from './packs.ts';
import { loadSeedFile } from './seed.ts';

const counts = (entries: [string, number, number, number][]) =>
  entries.map(([slug, d1, d2, d3], i) => ({ id: i + 1, slug, name: slug, counts: [d1, d2, d3] as [number, number, number] }));

describe('packs', () => {
  it('bundled pack file is valid', () => {
    expect(loadPacks().length).toBeGreaterThan(0);
  });

  it('rejects unknown categories and duplicate packs', () => {
    const pack = { slug: 'a', name: 'A', description: 'x', mode: 'classic', categories: ['nincs'] };
    expect(() => loadPacks([pack], ['film'])).toThrow(/unknown category "nincs"/);
    const ok = { ...pack, categories: ['film'] };
    expect(() => loadPacks([ok, ok], ['film'])).toThrow(/defined twice/);
  });

  it('offers packs with enough questions, without their empty categories', () => {
    const packs = loadPacks(
      [
        { slug: 'kicsi', name: 'Kicsi', description: 'x', mode: 'classic', categories: ['a'] },
        { slug: 'nagy', name: 'Nagy', description: 'x', mode: 'classic', categories: ['a', 'b', 'c'] },
        { slug: 'mind', name: 'Mind', description: 'x', mode: 'classic', categories: '*' },
      ],
      ['a', 'b', 'c'],
    );
    const offers = buildOffers(packs, { mc: counts([['a', 5, 5, 5], ['b', 10, 10, 10], ['c', 0, 0, 0]]) }, 30);
    expect(offers.map((o) => o.slug)).toEqual(['nagy', 'mind']);
    expect(offers[0]!.categories.map((c) => c.slug)).toEqual(['a', 'b']);
    expect(offers[0]!.questions).toBe(45);
  });

  it('the Alap pack is playable with the bundled questions', () => {
    const seed = loadSeedFile();
    const bySlug = seed.categories.map((c, i) => {
      const qs = seed.questions.filter((q) => q.category === c.slug);
      const n = (d: number) => qs.filter((q) => q.difficulty === d).length;
      return { id: i + 1, slug: c.slug, name: c.name, counts: [n(1), n(2), n(3)] as [number, number, number] };
    });
    const offers = buildOffers(loadPacks(), { mc: bySlug }, PACK_MIN_QUESTIONS);
    expect(offers.map((o) => o.slug)).toContain('alap');
  });

  it('sizes each pack by the kind of question its mode plays', () => {
    const packs = loadPacks(
      [
        { slug: 'kviz', name: 'Kvíz', description: 'x', mode: 'classic', categories: '*' },
        { slug: 'blof', name: 'Blöff', description: 'x', mode: 'bluff', categories: '*' },
        { slug: 'tipp', name: 'Tipp', description: 'x', mode: 'guess', categories: '*' },
      ],
      ['a', 'b'],
    );
    const offers = buildOffers(packs, { mc: counts([['a', 20, 20, 20], ['b', 0, 0, 0]]), bluff: counts([['a', 0, 0, 0], ['b', 3, 3, 4]]) }, 10);
    expect(offers.map((o) => o.slug)).toEqual(['kviz', 'blof']);
    expect(offers[1]!.questions).toBe(10);
    expect(offers[1]!.categories.map((c) => c.slug)).toEqual(['b']);
  });
});
