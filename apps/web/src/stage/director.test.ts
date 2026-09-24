import type { Phase } from '@trivia/shared';
import { TIMINGS } from '@trivia/shared';
import { describe, expect, it } from 'vitest';
import { REVEAL_BEATS, SHOTS, shotsFor } from './director.ts';
import { averageFps } from './perfGuard.ts';

const PHASES: Phase[] = ['lobby', 'intro', 'vote', 'vote_result', 'question_read', 'question_open', 'reveal', 'scoreboard', 'final'];

describe('director', () => {
  it('has a camera plan for every phase, in time order, using known shots', () => {
    for (const phase of PHASES) {
      const cues = shotsFor(phase);
      expect(cues.length, phase).toBeGreaterThan(0);
      expect(cues.map((c) => c.at)).toEqual([...cues.map((c) => c.at)].sort((a, b) => a - b));
      for (const c of cues) expect(SHOTS[c.shot]).toBeDefined();
    }
  });

  it('finishes every move within its phase', () => {
    const lengths: Partial<Record<Phase, number>> = {
      intro: TIMINGS.intro,
      vote_result: TIMINGS.voteResult,
      question_read: TIMINGS.questionRead,
      reveal: TIMINGS.reveal,
      scoreboard: TIMINGS.scoreboard,
    };
    for (const [phase, ms] of Object.entries(lengths) as [Phase, number][]) {
      for (const c of shotsFor(phase)) expect(c.at + c.duration, phase).toBeLessThanOrEqual(ms / 1000);
    }
  });

  it('keeps the reveal beats in order and inside the reveal', () => {
    const beats = Object.values(REVEAL_BEATS);
    expect(REVEAL_BEATS.correctFlash).toBeGreaterThan(REVEAL_BEATS.wrongDropStart + 3 * REVEAL_BEATS.wrongDropStep);
    expect(Math.max(...beats)).toBeLessThan(TIMINGS.reveal / 1000);
  });
});

describe('averageFps', () => {
  it('computes frames per second from timestamps', () => {
    const at60 = Array.from({ length: 61 }, (_, i) => i * (1000 / 60));
    expect(averageFps(at60)).toBeCloseTo(60, 5);
    expect(averageFps([0])).toBe(0);
  });
});
