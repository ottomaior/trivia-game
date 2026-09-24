import { describe, expect, it } from 'vitest';
import { spinSequence } from './slotSpin.ts';

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
