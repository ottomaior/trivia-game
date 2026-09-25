import { describe, expect, it } from 'vitest';
import { analyse, averageFps, jankShare, tooSlow } from './perfGuard.ts';

/** Timestamps of `n` frames at `fps`, with every `every`-th frame taking `stallMs` instead. */
function frames(fps: number, n: number, stall?: { every: number; ms: number }): number[] {
  const out = [0];
  for (let i = 1; i < n; i++) {
    const gap = stall && i % stall.every === 0 ? stall.ms : 1000 / fps;
    out.push(out[i - 1]! + gap);
  }
  return out;
}

describe('frame analysis', () => {
  it('averages the rate and sees no stutter in steady frames', () => {
    expect(averageFps(frames(60, 180))).toBeCloseTo(60, 5);
    expect(jankShare(frames(60, 180))).toBe(0);
    expect(averageFps(frames(30, 90))).toBeCloseTo(30, 5);
  });

  it('counts long frames as stutter', () => {
    const s = analyse(frames(60, 180, { every: 10, ms: 100 }));
    expect(s.jank).toBeCloseTo(0.1, 1);
    expect(s.fps).toBeLessThan(50);
  });

  it('is empty without enough frames', () => {
    expect(averageFps([])).toBe(0);
    expect(jankShare([0, 16])).toBe(0);
  });
});

describe('tooSlow', () => {
  it('passes a smooth 60 and fails a stuttering 30', () => {
    expect(tooSlow({ fps: 60, jank: 0 })).toBe(false);
    expect(tooSlow({ fps: 30, jank: 0.3 })).toBe(true);
    expect(tooSlow({ fps: 10, jank: 1 })).toBe(true);
  });

  it('takes a steady 30 for a capped display, not an overloaded page', () => {
    expect(tooSlow({ fps: 30, jank: 0 })).toBe(false);
    expect(tooSlow({ fps: 20, jank: 0 })).toBe(true);
  });

  it('judges the busy sample against the idle ceiling', () => {
    const sixty = { fps: 60, jank: 0 };
    expect(tooSlow({ fps: 45, jank: 0.1 }, sixty)).toBe(false);
    expect(tooSlow({ fps: 35, jank: 0.4 }, sixty)).toBe(true);
    const thirty = { fps: 30, jank: 0 };
    expect(tooSlow({ fps: 28, jank: 0.05 }, thirty)).toBe(false);
    expect(tooSlow({ fps: 20, jank: 0.4 }, thirty)).toBe(true);
  });
});
