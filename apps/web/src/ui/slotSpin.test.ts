import { describe, expect, it } from 'vitest';
import { spinAmong, spinSequence, tiedLeaders } from './slotSpin.ts';

describe('spinSequence', () => {
  it('always lands on the chosen card, lighting cards in order', () => {
    for (let chosen = 0; chosen < 3; chosen++) {
      const seq = spinSequence(chosen, 3);
      expect(seq.at(-1)!.index).toBe(chosen);
      for (let i = 1; i < seq.length; i++) expect(seq[i]!.index).toBe((seq[i - 1]!.index + 1) % 3);
    }
  });

  it('slows down and finishes on time', () => {
    const seq = spinSequence(1, 3, 11, 1150);
    const gaps = seq.map((s, i) => s.at - (seq[i - 1]?.at ?? 0));
    for (let i = 1; i < gaps.length; i++) expect(gaps[i]).toBeGreaterThanOrEqual(gaps[i - 1]! - 1);
    expect(seq.at(-1)!.at).toBeGreaterThanOrEqual(1140);
    expect(seq.at(-1)!.at).toBeLessThanOrEqual(1160);
  });
});

describe('spinAmong', () => {
  it('lights only the tied cards and lands on the chosen one', () => {
    for (const chosen of [0, 2]) {
      const seq = spinAmong(chosen, [0, 2]);
      expect(seq.at(-1)!.index).toBe(chosen);
      expect(seq.every((s) => s.index === 0 || s.index === 2)).toBe(true);
    }
  });
});

describe('tiedLeaders', () => {
  it('finds a tie at the top, whatever order the votes came in', () => {
    expect(tiedLeaders({ a: 0, b: 2 }, 3)).toEqual([0, 2]);
    expect(tiedLeaders({ b: 2, a: 0 }, 3)).toEqual([0, 2]);
    expect(tiedLeaders({ a: 0, b: 1, c: 2 }, 3)).toEqual([0, 1, 2]);
  });

  it('is null with a clear winner or no votes', () => {
    expect(tiedLeaders({ a: 1, b: 1, c: 0 }, 3)).toBeNull();
    expect(tiedLeaders({}, 3)).toBeNull();
  });
});
